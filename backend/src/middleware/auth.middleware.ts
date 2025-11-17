import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/auth.service';

// 扩展 Express Request 类型，添加 user 属性
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * 认证中间件 - 验证 JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: '未提供认证 token' });
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    return res.status(401).json({ error: '认证失败: ' + error.message });
  }
}

/**
 * 管理员权限中间件 - 验证用户是否为 ADMIN
 * 必须在 authenticate 中间件之后使用
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: '未认证' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
}
