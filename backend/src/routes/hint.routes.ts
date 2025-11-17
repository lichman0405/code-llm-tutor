import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { createLLMService, extractJSON } from '../services/llm.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router: Router = Router();

// 请求提示 schema
const requestHintSchema = z.object({
  problemId: z.string(),
  hintLevel: z.number().min(1).max(4),
  currentCode: z.string().optional(),
  language: z.string().optional(),
  forceRegenerate: z.boolean().optional(),
});

/**
 * POST /api/hints/request
 * 请求提示（强制逐级获取）
 */
router.post('/request', async (req, res) => {
  try {
    // 验证 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // 验证请求体
    const validationResult = requestHintSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: validationResult.error.errors[0].message 
      });
    }

    const { problemId, hintLevel, currentCode, language, forceRegenerate } = validationResult.data;

    // 修复：强制逐级提示机制 - 检查是否已经获取过更低等级的提示
    const existingHints = await prisma.hint.findMany({
      where: {
        userId,
        problemId,
      },
      orderBy: { hintLevel: 'asc' },
    });

    // 检查是否可以请求当前等级的提示
    if (hintLevel > 1) {
      const hasPreviousLevel = existingHints.some(h => h.hintLevel === hintLevel - 1);
      if (!hasPreviousLevel) {
        return res.status(400).json({ 
          error: `必须先获取 Level ${hintLevel - 1} 的提示才能获取当前等级提示` 
        });
      }
    }

    // 检查是否已经获取过当前等级的提示（非强制重新生成）
    if (!forceRegenerate) {
      const existingHint = existingHints.find(h => h.hintLevel === hintLevel);
      if (existingHint) {
        return res.json({
          hint: {
            level: existingHint.hintLevel,
            content: existingHint.hintContent,
            penalty: getPenaltyPercentage(existingHint.hintLevel),
            language: existingHint.language,
          },
          alreadyObtained: true,
        });
      }
    }

    // 获取题目信息
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { description: true, title: true },
    });

    if (!problem) {
      return res.status(404).json({ error: '题目不存在' });
    }

    // 获取用户LLM配置
    const userLLMService = await createLLMService(userId);

    // 生成提示
    const hintContent = await userLLMService.generateHint(
      problem.description,
      currentCode || '',
      hintLevel,
      language || 'python'
    );

    // 保存提示到数据库
    const hint = await prisma.hint.create({
      data: {
        userId,
        problemId,
        hintLevel,
        hintContent,
        userCodeSnapshot: currentCode,
        generatedBy: 'LLM',
        generationTime: 0, // 可以添加实际生成时间
        language: language || 'python',
      },
    });

    res.json({
      hint: {
        level: hint.hintLevel,
        content: hint.hintContent,
        penalty: getPenaltyPercentage(hint.hintLevel),
        language: hint.language,
      },
      alreadyObtained: false,
    });
  } catch (error: any) {
    console.error('Request hint error:', error);
    res.status(500).json({ error: error.message || '获取提示失败' });
  }
});

/**
 * GET /api/hints/problem/:problemId
 * 获取某题的所有提示历史
 */
router.get('/problem/:problemId', async (req, res) => {
  try {
    // 验证 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.problemId;

    const hints = await prisma.hint.findMany({
      where: {
        userId,
        problemId,
      },
      orderBy: { hintLevel: 'asc' },
      select: {
        id: true,
        hintLevel: true,
        hintContent: true,
        language: true,
        createdAt: true,
      },
    });

    res.json({ hints });
  } catch (error: any) {
    console.error('Get hints error:', error);
    res.status(500).json({ error: '获取提示历史失败' });
  }
});

/**
 * 获取扣分百分比
 */
function getPenaltyPercentage(level: number): number {
  const penalties = [0, 5, 15, 30, 50]; // Level 0不使用，从1开始
  return penalties[level] || 0;
}

export default router;
