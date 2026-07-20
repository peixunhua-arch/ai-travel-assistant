// POI 社区口碑接口（阶段 3.5 闭环后半）：
//   GET /api/pois/reputation?ids=A,B,C —— 批量查口碑，供详情页角标展示
import { Router } from 'express';
import { z } from 'zod';
import type { ApiError, PoiReputation } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { getPoiReputation } from '../store/reviewRepo.js';

export const poisRouter = Router();

const querySchema = z.object({
  ids: z.string().min(1, '缺少 ids'),
});

poisRouter.get('/reputation', requireAuth, (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    const err: ApiError = { error: '缺少 ids', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  const ids = parsed.data.ids
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50); // 防滥用

  const items: PoiReputation[] = [];
  for (const id of ids) {
    const rep = getPoiReputation(id);
    if (rep) items.push(rep);
  }
  res.json({ items });
});
