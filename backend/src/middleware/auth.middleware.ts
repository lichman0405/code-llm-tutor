import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/auth.service';

// Extend Express Request type to add `user` property
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware - verify JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Authentication failed: ' + error.message });
  }
}

/**
 * Admin authorization middleware - checks whether user is ADMIN
 * Must be used after the authenticate middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  next();
}
