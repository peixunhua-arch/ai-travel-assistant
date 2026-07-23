// 对话接口：需登录，把用户消息转给 Claude，返回回复。支持 SSE 流式（?stream=1）与 §16.1 图片。
import { Router } from 'express';
import { z } from 'zod';
import type { ChatResponse, ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ask, askStream } from '../services/ai/index.js';

export const chatRouter = Router();

const bodySchema = z
  .object({
    message: z.string().min(1, '消息不能为空').max(2000, '消息太长'),
    imageBase64: z.string().max(4_000_000).optional(),
    imageMediaType: z.enum(['image/jpeg', 'image/png']).optional(),
  })
  .refine(
    (d) => !d.imageBase64 || d.imageMediaType,
    { message: '上传图片时需指定 imageMediaType' },
  );

chatRouter.post('/', requireAuth, rateLimit('chat'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '消息格式不对', code: 'BAD_MESSAGE' };
    return res.status(400).json(err);
  }

  const useStream = req.query.stream === '1' || req.query.stream === 'true';
  const image =
    parsed.data.imageBase64 && parsed.data.imageMediaType
      ? { base64: parsed.data.imageBase64, mediaType: parsed.data.imageMediaType }
      : undefined;

  try {
    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const write = (data: object) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const full = await askStream(parsed.data.message, (delta) => {
        write({ text: delta });
      }, image);
      write({ done: true, reply: full });
      res.end();
      return;
    }

    const reply = await ask(parsed.data.message, image);
    const body: ChatResponse = { reply };
    res.json(body);
  } catch (e) {
    console.error('[chat] Claude 调用失败:', e);
    if (useStream && !res.headersSent) {
      const err: ApiError = { error: 'AI 暂时不可用，请稍后重试', code: 'CLAUDE_ERROR' };
      return res.status(502).json(err);
    }
    if (useStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'AI 暂时不可用' })}\n\n`);
      res.end();
      return;
    }
    const err: ApiError = { error: 'AI 暂时不可用，请稍后重试', code: 'CLAUDE_ERROR' };
    res.status(502).json(err);
  }
});
