import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Get paginated list of all users
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
    res.status(500).json({ error: 'Failed to get users list.' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Modify user role
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

    res.json({ user, message: 'User role updated' });
  } catch (error: any) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/**
 * GET /api/admin/problems
 * Get all problems (admin view, includes stats and visibility)
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
    res.status(500).json({ error: 'Failed to get problem list' });
  }
});

/**
 * DELETE /api/admin/problems/:id
 * Delete problem
 */
router.delete('/problems/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.problem.delete({
      where: { id },
    });

    res.json({ message: 'Problem deleted' });
  } catch (error: any) {
    console.error('Delete problem error:', error);
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Soft-delete user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: 'User already deleted' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: 'Cannot delete admin account' });
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    res.json({ message: 'User deleted', userId: id });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * POST /api/admin/users/:id/require-password-reset
 * Require user to reset password
 */
router.post('/users/:id/require-password-reset', async (req, res) => {
  try {
    const { id } = req.params;

    // Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: 'User already deleted' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: 'Cannot perform this action on an admin account' });
    }

    // Set password reset flag
    await prisma.user.update({
      where: { id },
      data: {
        passwordResetRequired: true
      }
    });

    res.json({ message: 'Requested user to reset password', userId: id });
  } catch (error: any) {
    console.error('Require password reset error:', error);
    res.status(500).json({ error: 'Failed to set password reset flag' });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Admin reset user password directly (set temporary password)
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.deleted) {
      return res.status(400).json({ error: 'User already deleted' });
    }

    if (targetUser.role === 'ADMIN') {
      return res.status(403).json({ error: 'Cannot perform this action on an admin account' });
    }

    // Hash the new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and set the password reset required flag
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        passwordResetRequired: true // User will be required to change password at next login
      }
    });

    res.json({ 
      message: 'Password reset; user will be required to change password at next login', 
      userId: id,
      temporaryPassword: newPassword // Return temporary password for admin to notify user
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * GET /api/admin/stats
 * Get platform statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [userCount, problemCount, submissionCount, adminCount] = await Promise.all([
      prisma.user.count(),
      prisma.problem.count(),
      prisma.submission.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ]);

    // Get submission statistics for the last 7 days
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
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
// No Chinese found — no changes required.
