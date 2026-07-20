import { Router } from 'express';
import { z } from 'zod';
import type { ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { upsertChatFeedback } from '../store/chatFeedbackRepo.js';

export const chatFeedbackRouter = Router();

const bodySchema = z.object({
  messageId: z.string().min(4).max(128),
  sentiment: z.union([z.literal(1), z.literal(-1)]),
});

chatFeedbackRouter.post('/', requireAuth, (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '反馈数据无效', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }
  upsertChatFeedback(req.userId!, parsed.data.messageId, parsed.data.sentiment);
  res.json({ ok: true });
});
