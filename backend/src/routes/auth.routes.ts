import { Router, Request, Response } from 'express';
import { register, login } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// 注册 schema
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

// 登录 schema
const loginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    
    const result = await register(username, email, password);
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      error: error.message || '注册失败',
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = loginSchema.parse(req.body);
    
    const result = await login(usernameOrEmail, password);
    
    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      error: error.message || '登录失败',
    });
  }
});

/**
 * POST /api/auth/register-admin
 * 注册管理员账号（仅开发环境）
 */
router.post('/register-admin', async (req: Request, res: Response) => {
  // 仅在开发环境下允许使用
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: '此接口仅在开发环境下可用',
    });
  }

  try {
    const { username, email, password } = registerSchema.parse(req.body);
    
    const result = await register(username, email, password, 'ADMIN');
    
    res.status(201).json({
      ...result,
      message: '管理员账号创建成功',
    });
  } catch (error: any) {
    console.error('Register admin error:', error);
    res.status(400).json({
      error: error.message || '创建管理员账号失败',
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // TODO: 实现 auth 中间件后完成
    res.json({
      success: true,
      data: { message: 'Not implemented yet' },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/reset-password
 * 重置密码
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    let decoded: any;
    try {
      decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token 无效或已过期' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请提供当前密码和新密码' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证当前密码
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    // 更新密码并清除重置标志
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        passwordHash: hashedPassword,
        passwordResetRequired: false,
      },
    });

    res.json({ message: '密码已重置' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '密码重置失败' });
  }
});

export default router;
