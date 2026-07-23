// 行程接口：需登录，把「生成需求」转给 Claude，返回结构化行程。无状态——阶段 2 只生成不存库
//（存哪？存在用户手机本地 AsyncStorage，那是前端的事；后端存数据库是阶段 3）。
//
// 结构镜像 chat.ts：同样 Router + zod 校验 body + requireAuth。差别在错误处理——
// generateTrip 抛的是「普通对象」{code} 而不是 Error 实例，所以 catch 里用 e as {code} 接，
// 千万别写 instanceof Error（那样永远进不去，会把 422 误判成 500/502）。
import { Router } from 'express';
import { z } from 'zod';
import type { TripGenerateResponse, ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { generateTrip } from '../services/ai/index.js';

export const tripRouter = Router();

// 请求体校验：卡在入口，别让脏数据流到 Claude 那步。
//   destination 非空、最长 100；days 整数 1-14；budget 整数 ≥0（0=不限）；
//   preferences 字符串数组、最多 10 个；prompt 可选、最长 200。
const bodySchema = z.object({
  destination: z.string().min(1, '目的地不能为空').max(100, '目的地太长'),
  days: z.number().int().min(1, '至少 1 天').max(14, '最多 14 天'),
  budget: z.number().int().min(0),
  preferences: z.array(z.string()).max(10),
  prompt: z.string().max(200).optional(),
  travelMonth: z.string().max(20).optional(),
  companions: z.enum(['solo', 'couple', 'family', 'elder', 'friends']).optional(),
  pace: z.enum(['relaxed', 'moderate', 'packed']).optional(),
  departureCity: z.string().max(50).optional(),
  previousTripId: z.string().uuid().optional(),
});

tripRouter.post('/generate', requireAuth, rateLimit('trip'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '请求参数不对', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  try {
    // 阶段 3：generateTrip 现在返回 { trip, weather }（weather 可能为 null——工具没查到/失败时）。
    const { trip, weather, personalized, warnings } = await generateTrip(parsed.data, req.userId);
    const body: TripGenerateResponse = {
      destination: trip.destination,
      daysCount: trip.days.length,
      budgetEstimate: trip.budgetEstimate,
      days: trip.days,
      weather: weather ?? undefined,
      personalized: personalized || undefined,
      warnings:
        warnings.unenrichedCount > 0 || warnings.sparseDays.length > 0 ? warnings : undefined,
    };
    res.json(body);
  } catch (e) {
    // generateTrip 抛的是普通对象 { code, message }，不是 Error——用 as 断言接住。
    const err = e as { code?: string; message?: string };
    if (err.code === 'TRIP_PARSE_FAILED') {
      // 模型连试 3 次都给不出合法结构：这是「内容问题」，用 422（请求本身没错，是结果不合规）。
      const body: ApiError = { error: 'AI 生成的行程格式有误，请重试', code: 'TRIP_PARSE_FAILED' };
      return res.status(422).json(body);
    }
    // 其余（含 CLAUDE_ERROR）：上游/网关问题，用 502。
    console.error('[trip] 生成失败:', e);
    const body: ApiError = { error: 'AI 暂时不可用，请稍后重试', code: 'CLAUDE_ERROR' };
    res.status(502).json(body);
  }
});
