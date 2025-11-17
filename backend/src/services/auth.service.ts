import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

// 修复：移除硬编码回退值，强制要求环境变量配置
const JWT_SECRET: Secret = process.env.JWT_SECRET as Secret;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in environment variables');
}

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

export interface TokenPayload extends JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

/**
 * 用户注册
 */
export async function register(
  username: string,
  email: string,
  password: string,
  role: UserRole = 'USER'
) {
  // 检查用户是否已存在
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }]
    }
  });

  if (existingUser) {
    throw new Error(existingUser.username === username ? '用户名已存在' : '邮箱已被注册');
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(password, 10);

  // 管理员自动完成warmup，因为他们不是目标用户
  // 普通用户需要完成warmup以获得个性化学习体验
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role,
      warmupCompleted: role === 'ADMIN' ? true : false, // 管理员自动完成warmup
    }
  });

  // 生成 token
  const token = generateToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      currentLevel: user.currentLevel,
      warmupCompleted: user.warmupCompleted,
      role: user.role,
    },
    token,
  };
}

/**
 * 用户登录
 */
export async function login(usernameOrEmail: string, password: string) {
  // 查找用户
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 检查是否被软删除
  if (user.deleted) {
    throw new Error('账户已被禁用');
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('密码错误');
  }

  // 检查是否需要重置密码
  if (user.passwordResetRequired) {
    const resetToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        requirePasswordReset: true
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      requirePasswordReset: true,
      token: resetToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      message: '您需要重置密码才能继续'
    };
  }

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  // 生成 token
  const token = generateToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      currentLevel: user.currentLevel,
      warmupCompleted: user.warmupCompleted,
      learningGoal: user.learningGoal,
      role: user.role,
    },
    token,
  };
}

/**
 * 生成 JWT token
 */
function generateToken(payload: TokenPayload): string {
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

/**
 * 验证 JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error('Token 无效或已过期');
  }
}

/**
 * 从请求头中获取用户信息
 */
export function getUserFromToken(authHeader?: string): TokenPayload {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('未提供认证令牌');
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
}
