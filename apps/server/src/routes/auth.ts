// 设备匿名认证：App 传 deviceId，后端 upsert 用户并签发 JWT。
import { Router } from 'express';
import { z } from 'zod';
import type { AuthDeviceResponse, ApiError } from '@travel/shared';
import { upsertUserByDeviceId, getUserProfile, updateUserProfile } from '../store/userRepo.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const bodySchema = z.object({
  deviceId: z.string().min(8, 'deviceId 太短'),
});

const profileSchema = z.object({
  displayName: z.string().min(1).max(20).optional(),
  avatar: z.string().max(120_000).optional(),
});

authRouter.post('/device', (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: 'deviceId 无效', code: 'BAD_DEVICE_ID' };
    return res.status(400).json(err);
  }

  const user = upsertUserByDeviceId(parsed.data.deviceId);
  const { token, expiresIn } = signToken(user.id);

  const body: AuthDeviceResponse = { token, userId: user.id, expiresIn };
  res.json(body);
});

authRouter.get('/profile', requireAuth, (req, res) => {
  const profile = getUserProfile(req.userId!);
  if (!profile) {
    const err: ApiError = { error: '用户不存在', code: 'USER_NOT_FOUND' };
    return res.status(404).json(err);
  }
  res.json(profile);
});

authRouter.patch('/profile', requireAuth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '资料格式不对', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }
  if (!parsed.data.displayName && !parsed.data.avatar) {
    const err: ApiError = { error: '没有可更新的字段', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }
  const profile = updateUserProfile(req.userId!, parsed.data);
  if (!profile) {
    const err: ApiError = { error: '用户不存在', code: 'USER_NOT_FOUND' };
    return res.status(404).json(err);
  }
  res.json(profile);
});
