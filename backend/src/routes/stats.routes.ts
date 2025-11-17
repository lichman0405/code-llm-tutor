import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * GET /api/stats/overview
 * 获取用户学习概览统计
 */
router.get('/overview', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // 获取用户基本信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentLevel: true,
        totalProblemsSolved: true,
        totalSubmissions: true,
        algorithmProficiency: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 获取所有提交记录
    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: {
        score: true,
        status: true,
        submittedAt: true,
        problem: {
          select: {
            difficulty: true,
            algorithmTypes: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // 计算平均分(只统计完成的题目)
    const completedSubmissions = submissions.filter(
      (s) => s.status === 'accepted' && s.score !== null
    );
    const averageScore =
      completedSubmissions.length > 0
        ? completedSubmissions.reduce((sum, s) => sum + Number(s.score), 0) / completedSubmissions.length
        : 0;

    // 按难度统计完成题数
    const difficultyDistribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      difficultyDistribution[i] = 0;
    }

    completedSubmissions.forEach((s) => {
      const difficulty = s.problem.difficulty;
      difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
    });

    // 统计最近30天的提交趋势
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = submissions.filter(
      (s) => new Date(s.submittedAt) >= thirtyDaysAgo
    );

    // 按日期分组统计
    const dailySubmissions: Record<string, number> = {};
    recentSubmissions.forEach((s) => {
      const date = new Date(s.submittedAt).toISOString().split('T')[0];
      dailySubmissions[date] = (dailySubmissions[date] || 0) + 1;
    });

    res.json({
      overview: {
        currentLevel: user.currentLevel,
        totalSolved: user.totalProblemsSolved,
        totalSubmissions: user.totalSubmissions,
        averageScore: Math.round(averageScore * 10) / 10,
        accuracyRate:
          user.totalSubmissions > 0
            ? Math.round((user.totalProblemsSolved / user.totalSubmissions) * 100)
            : 0,
      },
      difficultyDistribution,
      algorithmProficiency: user.algorithmProficiency,
      recentActivity: {
        last30Days: recentSubmissions.length,
        dailySubmissions,
      },
    });
  } catch (error: any) {
    console.error('Get stats overview error:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

/**
 * GET /api/stats/progress
 * 获取学习进度和成长曲线
 */
router.get('/progress', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // 获取最近20次提交记录(用于绘制成长曲线)
    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        status: 'accepted',
        score: { not: null },
      },
      select: {
        score: true,
        submittedAt: true,
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    // 反转顺序,按时间从早到晚
    const progressData = submissions.reverse().map((s, index) => ({
      submission: index + 1,
      score: Number(s.score),
      date: new Date(s.submittedAt).toLocaleDateString('zh-CN'),
      problemTitle: s.problem.title,
      difficulty: s.problem.difficulty,
    }));

    res.json({
      progress: progressData,
    });
  } catch (error: any) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: '获取进度数据失败' });
  }
});

export default router;
