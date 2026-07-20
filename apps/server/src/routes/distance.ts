import { Router } from 'express';
import { z } from 'zod';
import type { ApiError, DistanceResult } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { measureCommute } from '../services/distance.js';

export const distanceRouter = Router();

const querySchema = z.object({
  fromLng: z.coerce.number(),
  fromLat: z.coerce.number(),
  toLng: z.coerce.number(),
  toLat: z.coerce.number(),
});

distanceRouter.get('/', requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    const err: ApiError = { error: '坐标参数无效', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }
  try {
    const result = await measureCommute(
      parsed.data.fromLng,
      parsed.data.fromLat,
      parsed.data.toLng,
      parsed.data.toLat,
    );
    const body: DistanceResult = result;
    res.json(body);
  } catch (e) {
    console.error('[distance]', e);
    const err: ApiError = { error: '距离查询失败', code: 'DISTANCE_FAILED' };
    res.status(502).json(err);
  }
});
