import { Request, Response, NextFunction } from 'express';
import { User } from '../models/types';
import { getUserByToken } from '../utils/auth';

export interface AuthedRequest extends Request { user: User; }

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);
  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}
