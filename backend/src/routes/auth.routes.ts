import { Router, Request, Response } from 'express';
import { register, login } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// Register schema
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

// Login schema
const loginSchema = z.object({
  usernameOrEmail: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * User registration
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    
    const result = await register(username, email, password);
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      error: error.message || 'Registration failed',
    });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = loginSchema.parse(req.body);
    
    const result = await login(usernameOrEmail, password);
    
    res.json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      error: error.message || 'Login failed',
    });
  }
});

/**
 * POST /api/auth/register-admin
 * Register admin account (development only)
 */
router.post('/register-admin', async (req: Request, res: Response) => {
  // Only allowed in development environment
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'This endpoint is only available in development environment',
    });
  }

  try {
    const { username, email, password } = registerSchema.parse(req.body);
    
    const result = await register(username, email, password, 'ADMIN');
    
    res.status(201).json({
      ...result,
      message: 'Admin account created successfully',
    });
  } catch (error: any) {
    console.error('Register admin error:', error);
    res.status(400).json({
      error: error.message || 'Failed to create admin account',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // TODO: Complete after implementing auth middleware
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
 * Reset password
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    let decoded: any;
    try {
      decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token is invalid or expired' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide current password and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password and clear reset flag
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        passwordHash: hashedPassword,
        passwordResetRequired: false,
      },
    });

    res.json({ message: 'Password has been reset' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
