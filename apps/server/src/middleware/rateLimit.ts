// 简单限流（技术方案 §5 / 阶段 4）：按 userId 限制 chat/trip 调用频率，防刷 Key。
import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@travel/shared';

type Scope = 'chat' | 'trip';

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const LIMITS: Record<Scope, number> = {
  chat: Number(process.env.RATE_LIMIT_CHAT_PER_MIN ?? 20),
  trip: Number(process.env.RATE_LIMIT_TRIP_PER_MIN ?? 5),
};

function clientKey(req: Request, scope: Scope): string {
  const uid = (req as Request & { userId?: string }).userId;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `${scope}:${uid ?? ip}`;
}

export function rateLimit(scope: Scope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req, scope);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > LIMITS[scope]) {
      const err: ApiError = {
        error: '请求太频繁，请稍后再试',
        code: 'RATE_LIMITED',
      };
      res.status(429).json(err);
      return;
    }
    next();
  };
}
