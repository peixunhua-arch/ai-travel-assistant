// 天气接口（阶段 3 打磨）：给「行程详情页」实时查目的地未来 3 天天气用。
//
// 为什么单独开这个接口？
//   天气是「未来 3 天预报」，带绝对日期。行程存进手机本地后过几天再打开，当初生成时那份预报
//   早过期了（显示 7/11 的天气给 7/20 才看的用户，是错的）。所以详情页不存旧天气，而是
//   每次打开「现拉一份最新的」——这就需要一个能按城市名查天气的独立 HTTP 接口。
//
// 结构镜像 trip.ts：Router + requireAuth + zod 校验。差别在错误处理更宽容：
//   天气只是行程页的「锦上添花」，查不到（未知城市 / 和风失败 / QPS 超限）都不该弹错，
//   一律兜成 200 + 空数组，前端据「空」自然不显示天气条。只有「连 city 都没传」才 400。
import { Router } from 'express';
import { z } from 'zod';
import type { WeatherDay, ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { getWeather } from '../services/weather.js';

export const weatherRouter = Router();

// query 校验：只要一个非空 city。
const querySchema = z.object({
  city: z.string().min(1, '缺少城市').max(100, '城市名太长'),
});

weatherRouter.get('/', requireAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    const err: ApiError = { error: '缺少城市参数', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  try {
    const { days } = await getWeather(parsed.data.city);
    res.json({ weather: days });
  } catch (e) {
    // 未知城市 / 和风接口报错 / QPS 超限：都不是致命错，兜成空数组让前端静默不显示。
    console.warn('[weather] 查询失败（返回空，不影响详情页）:', (e as Error)?.message);
    res.json({ weather: [] as WeatherDay[] });
  }
});
