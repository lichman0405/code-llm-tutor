import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * 获取所有用户列表（分页）
 */
router.get('/users', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { deleted: false },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          currentLevel: true,
          warmupCompleted: true,
          totalProblemsSolved: true,
          totalSubmissions: true,
          averageScore: true,
          createdAt: true,
          lastLogin: true,
          passwordResetRequired: true,
          _count: {
            select: {
              createdProblems: true,
            }
          }
        },
      }),
      prisma.user.count({ where: { deleted: false } }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * 修改用户角色
 */
const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    res.json({ user, message: '用户角色已更新' });
  } catch (error: any) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

/**
 * GET /api/admin/problems
 * 获取所有题目（管理视图，包含统计信息和可见性）
 */
router.get('/problems', async (req, res) => {
  try {
    const { page = '1', limit = '20', difficulty } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
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
          generatedBy: true,
          totalAttempts: true,
          totalSolved: true,
          averageScore: true,
          createdAt: true,
          isPublic: true,
          creatorId: true,
          creator: {
            select: {
              username: true,
            }
          },
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
    console.error('Get admin problems error:', error);
    res.status(500).json({ error: '获取题目列表失败' });
  }
});

/**
 * DELETE /api/admin/problems/:id
 * 删除题目
 */
router.delete('/problems/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.problem.delete({
      where: { id },
    });

    res.json({ message: '题目已删除' });
  } catch (error: any) {
    console.error('Delete problem error:', error);
    res.status(500).json({ error: '删除题目失败' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * 软删除用户
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查目标用户
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: '用户已被删除' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: '不能删除管理员账户' });
    }

    // 软删除
    await prisma.user.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: '用户已删除', userId: id });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

/**
 * POST /api/admin/users/:id/require-password-reset
 * 要求用户重置密码
 */
router.post('/users/:id/require-password-reset', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查目标用户
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: '用户已被删除' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: '不能对管理员账户执行此操作' });
    }

    // 设置密码重置标志
    await prisma.user.update({
      where: { id },
      data: {
        passwordResetRequired: true
      }
    });

    res.json({ message: '已要求用户重置密码', userId: id });
  } catch (error: any) {
    console.error('Require password reset error:', error);
    res.status(500).json({ error: '设置密码重置失败' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * 管理员直接重置用户密码（设置临时密码）
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6位' });
    }

    // 检查目标用户
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: '用户已被删除' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: '不能对管理员账户执行此操作' });
    }

    // 加密新密码
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码并设置强制重置标志
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        passwordResetRequired: true // 用户下次登录必须修改密码
      }
    });

    res.json({ 
      message: '密码已重置，用户下次登录时将被要求修改密码', 
      userId: id,
      temporaryPassword: newPassword // 返回临时密码供管理员告知用户
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

/**
 * GET /api/admin/stats
 * 获取平台统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const [userCount, problemCount, submissionCount, adminCount] = await Promise.all([
      prisma.user.count(),
      prisma.problem.count(),
      prisma.submission.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ]);

    // 获取最近7天的提交统计
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await prisma.submission.count({
      where: {
        submittedAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    res.json({
      stats: {
        totalUsers: userCount,
        totalProblems: problemCount,
        totalSubmissions: submissionCount,
        adminUsers: adminCount,
        recentSubmissions,
      },
    });
  } catch (error: any) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: '获取统计信息失败' });
  }
});

export default router;
