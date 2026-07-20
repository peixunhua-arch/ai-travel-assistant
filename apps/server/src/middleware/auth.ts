// JWT 校验中间件：从 Authorization: Bearer <token> 解析出 userId，挂到 req 上。
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiError } from '@travel/shared';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

// 给 Express 的 Request 补一个 userId 字段
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): { token: string; expiresIn: number } {
  const expiresIn = 30 * 24 * 60 * 60; // 30 天（秒）
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });
  return { token, expiresIn };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    const err: ApiError = { error: '缺少登录凭证', code: 'NO_TOKEN' };
    return res.status(401).json(err);
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    const err: ApiError = { error: '登录凭证无效或已过期', code: 'BAD_TOKEN' };
    return res.status(401).json(err);
  }
}
