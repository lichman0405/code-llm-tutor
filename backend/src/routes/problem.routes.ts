import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { createLLMService, extractJSON } from '../services/llm.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// 生成题目请求 schema
const generateProblemSchema = z.object({
  difficulty: z.number().min(1).max(10).optional(),
  algorithmTypes: z.array(z.string()).optional(),
  forceNew: z.boolean().optional(), // 是否强制生成新题目
});

/**
 * POST /api/problems/generate
 * 生成新题目 (基于用户水平)
 */
router.post('/generate', async (req, res) => {
  try {
    // 验证 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentLevel: true,
        algorithmProficiency: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 解析请求参数
    const validationResult = generateProblemSchema.safeParse(req.body);
    const { difficulty, algorithmTypes, forceNew } = validationResult.success
      ? validationResult.data
      : { difficulty: undefined, algorithmTypes: undefined, forceNew: false };

    // 使用用户当前水平或指定难度
    const targetDifficulty = difficulty || user.currentLevel;
    
    // 智能选择算法类型 (优先选择薄弱项)
    let targetAlgorithmTypes: string[];
    if (algorithmTypes) {
      targetAlgorithmTypes = algorithmTypes;
    } else {
      const proficiency = user.algorithmProficiency as Record<string, number>;
      if (proficiency && Object.keys(proficiency).length > 0) {
        // 选择熟练度最低的 2-3 个算法类型
        targetAlgorithmTypes = Object.entries(proficiency)
          .sort((a, b) => a[1] - b[1]) // 按熟练度升序
          .slice(0, 2)
          .map(([type]) => type);
      } else {
        targetAlgorithmTypes = ['array', 'string']; // 默认基础类型
      }
    }

    // 【混合模式】如果不是强制生成新题,先尝试从数据库中查找合适的题目
    if (!forceNew) {
      const existingProblem = await prisma.problem.findFirst({
        where: {
          difficulty: targetDifficulty,
          algorithmTypes: { hasSome: targetAlgorithmTypes },
          // 只查找公开题目或用户自己创建的题目
          OR: [
            { isPublic: true },
            { creatorId: userId }
          ],
          // 并且用户没有提交过
          NOT: {
            submissions: {
              some: { userId }
            }
          }
        },
        include: {
          _count: {
            select: { submissions: true }
          }
        }
      });

      // 如果找到已有题目,直接返回
      if (existingProblem) {
        console.log('Reusing existing problem:', existingProblem.id, existingProblem.title, 'for user:', userId);
        return res.json({
          problem: {
            id: existingProblem.id,
            title: existingProblem.title,
            description: existingProblem.description,
            difficulty: existingProblem.difficulty,
            algorithmTypes: existingProblem.algorithmTypes,
            examples: existingProblem.examples,
            expectedComplexity: existingProblem.expectedComplexity,
          },
          isNew: false,
        });
      }
    }

    // 如果没有合适的题目,调用 LLM 生成新题目
    console.log('Generating new problem with LLM...');
    
    // 创建用户专属的LLM服务
    const userLLMService = await createLLMService(userId);
    
    const problemJsonString = await userLLMService.generateProblem(
      targetDifficulty,
      targetAlgorithmTypes,
      user.currentLevel,
      user.algorithmProficiency as Record<string, number>
    );

    // 解析 LLM 返回的 JSON
    let problemData;
    try {
      const jsonString = extractJSON(problemJsonString);
      problemData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', problemJsonString);
      return res.status(500).json({ error: 'LLM 返回格式错误' });
    }

    // 保存题目到数据库
    const problem = await prisma.problem.create({
      data: {
        title: problemData.title,
        description: problemData.description,
        difficulty: targetDifficulty,
        algorithmTypes: targetAlgorithmTypes,
        examples: problemData.examples || [],
        testCases: problemData.testCases || [],
        standardSolutions: [],
        basicHints: problemData.hints || [],
        expectedComplexity: problemData.timeComplexity || 'O(n)',
        generatedBy: 'LLM',
        generationPrompt: `Difficulty: ${targetDifficulty}, Types: ${targetAlgorithmTypes.join(', ')}`,
        creatorId: userId, // 保存创建者
        isPublic: false,   // 默认私有
      },
    });

    res.json({
      problem: {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        algorithmTypes: problem.algorithmTypes,
        examples: problemData.examples || [],
        inputFormat: problemData.inputFormat,
        outputFormat: problemData.outputFormat,
        expectedComplexity: problem.expectedComplexity,
        hints: problemData.hints || [],
      },
      isNew: true,
    });
  } catch (error: any) {
    console.error('Generate problem error:', error);
    res.status(500).json({ error: error.message || '生成题目失败' });
  }
});

/**
 * GET /api/problems
 * 获取题目列表（只显示用户自己的题目或公开题目）
 */
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    const { page = '1', limit = '10', difficulty } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // 构建查询条件：用户自己创建的 OR 公开的题目
    const where: any = {
      OR: [
        { creatorId: userId },    // 用户自己创建的
        { isPublic: true },       // 公开的题目
      ]
    };
    
    if (difficulty) {
      where.difficulty = parseInt(difficulty as string);
    }

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          difficulty: true,
          algorithmTypes: true,
          createdAt: true,
          isPublic: true,
          creatorId: true,
          _count: {
            select: { submissions: true },
          },
        },
      }),
      prisma.problem.count({ where }),
    ]);

    res.json({
      problems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get problems error:', error);
    res.status(500).json({ error: '获取题目列表失败' });
  }
});

/**
 * GET /api/problems/:id
 * 获取题目详情（需要权限检查）
 */
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    console.log('🔍 Fetching problem:', problemId, 'for user:', userId);

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        submissions: {
          where: { userId },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            score: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!problem) {
      console.log('❌ Problem not found:', problemId);
      return res.status(404).json({ error: '题目不存在' });
    }

    console.log('📋 Problem found:', {
      id: problem.id,
      title: problem.title,
      isPublic: problem.isPublic,
      creatorId: problem.creatorId,
      requestUserId: userId,
    });

    // 权限检查：只能访问自己创建的题目或公开题目
    if (!problem.isPublic && problem.creatorId !== userId) {
      console.log('🚫 Permission denied: problem is private and user is not creator');
      return res.status(404).json({ error: '题目不存在' });
    }

    console.log('✅ Permission granted, returning problem');
    
    // 将 basicHints 映射为 hints 字段返回给前端
    const responseData = {
      ...problem,
      hints: problem.basicHints || []
    };
    
    res.json(responseData);
  } catch (error: any) {
    console.error('Get problem error:', error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

/**
 * PATCH /api/problems/:id/visibility
 * 切换题目的公开/私有状态
 */
router.patch('/:id/visibility', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    // 查找题目
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, creatorId: true, isPublic: true },
    });

    if (!problem) {
      return res.status(404).json({ error: '题目不存在' });
    }

    // 检查权限：只有创建者可以修改
    if (problem.creatorId !== userId) {
      return res.status(403).json({ error: '只能修改自己创建的题目' });
    }

    // 切换可见性
    const updatedProblem = await prisma.problem.update({
      where: { id: problemId },
      data: { isPublic: !problem.isPublic },
      select: { id: true, isPublic: true },
    });

    res.json({
      message: updatedProblem.isPublic ? '题目已设为公开' : '题目已设为私有',
      isPublic: updatedProblem.isPublic,
    });
  } catch (error: any) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ error: '切换可见性失败' });
  }
});

/**
 * DELETE /api/problems/:id
 * 删除题目（只能删除自己的私有题目）
 */
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    // 查找题目
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, creatorId: true, isPublic: true, title: true },
    });

    if (!problem) {
      return res.status(404).json({ error: '题目不存在' });
    }

    // 检查权限：只有创建者可以删除
    if (problem.creatorId !== userId) {
      return res.status(403).json({ error: '只能删除自己创建的题目' });
    }

    // 只能删除私有题目
    if (problem.isPublic) {
      return res.status(403).json({ error: '公开题目无法删除，请先设为私有' });
    }

    // 删除题目
    await prisma.problem.delete({
      where: { id: problemId },
    });

    res.json({ message: '题目已删除', title: problem.title });
  } catch (error: any) {
    console.error('Delete problem error:', error);
    res.status(500).json({ error: '删除题目失败' });
  }
});

export default router;
