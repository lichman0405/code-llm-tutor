import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { judge0Service } from '../services/judge0.service';
import { createLLMService, extractJSON } from '../services/llm.service';
import { evaluateDifficultyAdjustment, applyDifficultyAdjustment } from '../services/difficulty.service';
import { updateAlgorithmProficiency, updateRecentPerformance } from '../services/proficiency.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// 提交代码 schema
const submitCodeSchema = z.object({
  problemId: z.string(),
  code: z.string().min(1, '代码不能为空'),
  language: z.string(),
});

/**
 * 计算评分系数
 */
function calculateScoreFactors(
  passedCount: number,
  totalCount: number,
  executionTime: number,
  difficulty: number,
  hintsUsed: number[],
  codeQuality?: number
) {
  // 1. 正确率系数
  const passRate = totalCount > 0 ? passedCount / totalCount : 0;
  let correctnessCoeff = 0;
  if (passRate === 1.0) correctnessCoeff = 1.0;
  else if (passRate >= 0.8) correctnessCoeff = 0.7;
  else if (passRate >= 0.5) correctnessCoeff = 0.4;

  // 2. 时间系数 (根据难度估算预期时间)
  const expectedTime = difficulty <= 2 ? 300 :  // 5分钟
                       difficulty <= 4 ? 600 :  // 10分钟
                       difficulty <= 6 ? 900 :  // 15分钟
                       difficulty <= 8 ? 1200 : // 20分钟
                       1800; // 30分钟
  
  const timeRatio = executionTime / expectedTime;
  let timeCoeff = 1.0;
  if (timeRatio < 0.5) timeCoeff = 1.2;
  else if (timeRatio <= 1.0) timeCoeff = 1.0;
  else if (timeRatio <= 2.0) timeCoeff = 0.9;
  else timeCoeff = 0.7;

  // 3. 提示惩罚系数
  let hintPenalty = 1.0;
  if (hintsUsed.length > 0) {
    const maxHintLevel = Math.max(...hintsUsed);
    if (maxHintLevel === 1) hintPenalty = 0.95;
    else if (maxHintLevel === 2) hintPenalty = 0.85;
    else if (maxHintLevel === 3) hintPenalty = 0.70;
    else if (maxHintLevel === 4) hintPenalty = 0.50;
  }

  // 4. 代码质量系数 (使用 LLM 分析结果或默认 1.0)
  const qualityCoeff = codeQuality || 1.0;

  // 计算最终得分
  const finalScore = Math.round(100 * correctnessCoeff * timeCoeff * hintPenalty * qualityCoeff);

  return {
    correctnessCoeff,
    timeCoeff,
    hintPenalty,
    qualityCoeff,
    finalScore,
  };
}

/**
 * POST /api/submissions/submit
 * 提交代码并执行
 */
router.post('/submit', async (req, res) => {
  try {
    // 验证 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // 验证请求体
    const validationResult = submitCodeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors[0].message });
    }

    const { problemId, code, language } = validationResult.data;

    // 获取题目信息 (添加重试逻辑)
    let problem;
    let retries = 3;
    while (retries > 0) {
      try {
        problem = await prisma.problem.findUnique({
          where: { id: problemId },
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            algorithmTypes: true,
            testCases: true,
            expectedComplexity: true,
          },
        });
        break;
      } catch (dbError: any) {
        console.error('Database error, retrying...', dbError.message);
        retries--;
        if (retries === 0) throw dbError;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!problem) {
      return res.status(404).json({ error: '题目不存在' });
    }

    // 获取语言 ID
    const languageId = judge0Service.getLanguageId(language);

    // 运行测试用例
    const testCases = problem.testCases as Array<{ input: string; output: string }>;
    console.log('Test cases:', JSON.stringify(testCases, null, 2));
    console.log('User code:', code);
    console.log('Language ID:', languageId);
    
    const testResults = await judge0Service.runTestCases(code, languageId, testCases);
    
    // 打印详细的测试结果
    testResults.forEach((result, index) => {
      console.log(`Test case ${index + 1}:`, {
        input: testCases[index].input,
        expectedOutput: testCases[index].output,
        actualOutput: result.result.stdout,
        stderr: result.result.stderr,
        status: result.result.status,
        passed: result.passed,
      });
    });

    // 计算通过率
    const passedCount = testResults.filter(r => r.passed).length;
    const totalCount = testResults.length;
    const passRate = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

    // 判断状态
    const status = passRate === 100 ? 'accepted' : 'wrong_answer';

    // 使用 LLM 分析代码质量 (仅在全部通过时)
    let codeAnalysis = null;
    let qualityCoeff = 1.0;

    if (status === 'accepted') {
      try {
        // 创建用户专属的LLM服务
        const userLLMService = await createLLMService(userId);
        
        const analysisJson = await userLLMService.analyzeCode(
          code,
          language,
          problem.description
        );
        
        const jsonString = extractJSON(analysisJson);
        codeAnalysis = JSON.parse(jsonString);
        // 使用 overallScore 作为质量系数 (0-10 转为 0-1)
        qualityCoeff = (codeAnalysis.overallScore || 10) / 10;
      } catch (error) {
        console.error('Code analysis error:', error);
      }
    }

    // 获取用户已使用的提示 (从数据库查询)
    const usedHints = await prisma.hint.findMany({
      where: {
        userId,
        problemId,
      },
      select: { hintLevel: true },
    });
    const hintsUsed = usedHints.map(h => h.hintLevel);

    // 计算评分
    const executionTimeMs = parseInt(testResults[0]?.result.time || '0');
    const scoreFactors = calculateScoreFactors(
      passedCount,
      totalCount,
      executionTimeMs,
      problem.difficulty,
      hintsUsed,
      qualityCoeff
    );

    // 保存提交记录
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        code,
        language,
        status,
        score: scoreFactors.finalScore,
        correctnessScore: scoreFactors.correctnessCoeff * 100,
        timeScore: scoreFactors.timeCoeff * 100,
        hintPenalty: scoreFactors.hintPenalty * 100,
        qualityScore: scoreFactors.qualityCoeff * 100,
        passedCases: passedCount,
        totalCases: totalCount,
        executionTime: executionTimeMs,
        memoryUsed: testResults[0]?.result.memory || 0,
        testResults: testResults as any,
        hintsUsed,
        complexityAnalysis: codeAnalysis as any,
      },
    });

    // 更新用户统计
    if (status === 'accepted') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { recentScores: true, currentLevel: true },
      });

      if (user) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalProblemsSolved: { increment: 1 },
            totalSubmissions: { increment: 1 },
            recentScores: [...user.recentScores.slice(-9), scoreFactors.finalScore], // 保留最近10次分数
          },
        });
      }
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalSubmissions: { increment: 1 },
        },
      });
    }

    // 🎯 自适应难度调整
    const difficultyAdjustment = await evaluateDifficultyAdjustment(userId, scoreFactors.finalScore);
    let difficultyChanged = false;
    let newDifficulty: number | undefined;
    let adjustmentReason: string | undefined;

    if (difficultyAdjustment.shouldAdjust && difficultyAdjustment.newLevel) {
      const success = await applyDifficultyAdjustment(userId, difficultyAdjustment.newLevel);
      if (success) {
        difficultyChanged = true;
        newDifficulty = difficultyAdjustment.newLevel;
        adjustmentReason = difficultyAdjustment.reason;
        console.log(`Difficulty adjusted for user ${userId}: ${difficultyAdjustment.direction} to level ${newDifficulty} (${adjustmentReason})`);
      }
    }

    // 📊 更新用户能力画像
    await updateAlgorithmProficiency(userId, problem.algorithmTypes, scoreFactors.finalScore);
    await updateRecentPerformance(userId, scoreFactors.finalScore);

    res.json({
      submission: {
        id: submission.id,
        status: submission.status,
        score: submission.score,
        scoreBreakdown: {
          correctness: scoreFactors.correctnessCoeff,
          time: scoreFactors.timeCoeff,
          hintPenalty: scoreFactors.hintPenalty,
          quality: scoreFactors.qualityCoeff,
        },
        passedTests: passedCount,
        totalTests: totalCount,
        executionTime: submission.executionTime,
        memoryUsed: submission.memoryUsed?.toString(),
        hintsUsed,
        codeAnalysis,
      },
      difficultyAdjustment: difficultyChanged ? {
        changed: true,
        newLevel: newDifficulty,
        direction: difficultyAdjustment.direction,
        reason: adjustmentReason,
      } : {
        changed: false,
      },
      testResults: testResults.map((r, index) => ({
        testCase: index + 1,
        passed: r.passed,
        status: r.result.status.description,
        time: r.result.time,
        memory: r.result.memory,
        output: r.result.stdout,
        error: r.result.stderr,
      })),
    });
  } catch (error: any) {
    console.error('Submit code error:', error);
    res.status(500).json({ error: error.message || '提交代码失败' });
  }
});

/**
 * GET /api/submissions/history
 * 获取用户所有提交历史
 * ⚠️ 注意：必须放在 /:id 路由之前，否则 'history' 会被当作 ID 参数
 */
router.get('/history', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    const submissions = await prisma.submission.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        problemId: true,
        status: true,
        score: true,
        passedCases: true,
        totalCases: true,
        submittedAt: true,
        executionTime: true,
        hintsUsed: true,
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
      },
    });

    res.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        problemId: s.problemId,
        problemTitle: s.problem.title,
        difficulty: s.problem.difficulty,
        status: s.status,
        score: Number(s.score) || 0,
        passedCases: s.passedCases,
        totalCases: s.totalCases,
        submittedAt: s.submittedAt,
        executionTime: s.executionTime,
        hintsUsed: s.hintsUsed as number[],
      })),
    });
  } catch (error: any) {
    console.error('Get submission history error:', error);
    res.status(500).json({ error: '获取提交历史失败' });
  }
});

/**
 * GET /api/submissions/problem/:problemId
 * 获取某题目的提交历史
 */
router.get('/problem/:problemId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const problemId = req.params.problemId;

    const submissions = await prisma.submission.findMany({
      where: {
        userId: payload.userId,
        problemId,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        status: true,
        score: true,
        language: true,
        submittedAt: true,
        executionTime: true,
        passedCases: true,
        totalCases: true,
      },
    });

    res.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        status: s.status,
        score: typeof s.score === 'number' ? s.score : Number(s.score || 0),
        language: s.language,
        submittedAt: s.submittedAt,
        executionTime: s.executionTime,
        passedCases: s.passedCases,
        totalCases: s.totalCases,
      })),
    });
  } catch (error: any) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: '获取提交历史失败' });
  }
});

/**
 * GET /api/submissions/:id
 * 获取提交详情
 */
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const submissionId = req.params.id;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: '提交记录不存在' });
    }

    // 检查权限
    if (submission.userId !== payload.userId) {
      return res.status(403).json({ error: '无权访问此提交记录' });
    }

    res.json({ submission });
  } catch (error: any) {
    console.error('Get submission error:', error);
    res.status(500).json({ error: '获取提交记录失败' });
  }
});

export default router;
