// 行程上云接口：上传、列表、详情、更新（§5.4 PUT / §6.5 云端恢复）。
import { Router } from 'express';
import { z } from 'zod';
import type { TripGenerateResponse, UploadTripResponse, ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { insertTrip, updateTrip, getTripById, listTripsForUser } from '../store/tripRepo.js';

export const tripsRouter = Router();

const bodySchema = z.object({
  destination: z.string().min(1).max(100),
  daysCount: z.number().int().min(1).max(14),
  budgetEstimate: z.number().int().min(0),
  days: z.array(z.unknown()).min(1),
});

tripsRouter.get('/', requireAuth, (req, res) => {
  const items = listTripsForUser(req.userId!);
  res.json({ items });
});

tripsRouter.get('/:id', requireAuth, (req, res) => {
  const id = String(req.params.id);
  const trip = getTripById(id, req.userId!);
  if (!trip) {
    const err: ApiError = { error: '行程不存在', code: 'NOT_FOUND' };
    return res.status(404).json(err);
  }
  res.json(trip);
});

tripsRouter.post('/', requireAuth, (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '行程数据不完整', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  try {
    const serverTripId = insertTrip(req.userId!, parsed.data as TripGenerateResponse);
    const body: UploadTripResponse = { serverTripId };
    res.json(body);
  } catch (e) {
    console.error('[trips] 上传失败:', e);
    const err: ApiError = { error: '行程保存到云端失败', code: 'TRIP_UPLOAD_FAILED' };
    res.status(502).json(err);
  }
});

tripsRouter.put('/:id', requireAuth, (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '行程数据不完整', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }
  const ok = updateTrip(String(req.params.id), req.userId!, parsed.data as TripGenerateResponse);
  if (!ok) {
    const err: ApiError = { error: '行程不存在或无权修改', code: 'NOT_FOUND' };
    return res.status(404).json(err);
  }
  res.json({ ok: true });
});
