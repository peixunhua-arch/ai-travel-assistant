// 评价接口（阶段 3.5 闭环入口）：
//   POST /api/reviews         —— 提交/覆盖一条评价（upsert）
//   GET  /api/reviews?tripId= —— 取回该行程的评价，供详情页回显高亮
//
// ⚠️ 坑 #22：两个接口都必须先校验 tripId 属于当前用户，否则能给别人的行程刷评价。
//
// 本批：能评、能存、能回显 + 个人偏好查询（反哺可视化）。
import { Router } from 'express';
import { z } from 'zod';
import type { ReviewInput, ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import { getTripOwner } from '../store/tripRepo.js';
import { upsertReview, getTripReviews, getUserPreferences } from '../store/reviewRepo.js';

export const reviewsRouter = Router();

// POST body 校验：sentiment 必须是 1 或 -1；tags 最多 10 个；comment 最长 50。
const postSchema = z.object({
  tripId: z.string().min(1),
  poiId: z.string().min(1).nullish(), // 省略/null = 整程总评
  sentiment: z.union([z.literal(1), z.literal(-1)]),
  tags: z.array(z.string().max(20)).max(10).optional(),
  comment: z.string().max(50).optional(),
});

const getSchema = z.object({
  tripId: z.string().min(1, '缺少 tripId'),
});

// 归属校验小工具：返回 null 表示「校验通过」，否则返回一个已发好的响应（调用方直接 return）。
// 不存在 → 404；存在但不属于当前用户 → 403。
function checkOwner(tripId: string, userId: string, res: import('express').Response): boolean {
  const owner = getTripOwner(tripId);
  if (owner === null) {
    const err: ApiError = { error: '行程不存在', code: 'TRIP_NOT_FOUND' };
    res.status(404).json(err);
    return false;
  }
  if (owner !== userId) {
    const err: ApiError = { error: '无权评价该行程', code: 'FORBIDDEN' };
    res.status(403).json(err);
    return false;
  }
  return true;
}

reviewsRouter.post('/', requireAuth, (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '评价数据不对', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  const userId = req.userId!;
  if (!checkOwner(parsed.data.tripId, userId, res)) return; // 坑 #22：先校验归属

  try {
    upsertReview(userId, parsed.data as ReviewInput);
    res.json({ ok: true });
  } catch (e) {
    console.error('[reviews] 保存失败:', e);
    const err: ApiError = { error: '评价保存失败', code: 'REVIEW_SAVE_FAILED' };
    res.status(502).json(err);
  }
});

reviewsRouter.get('/', requireAuth, (req, res) => {
  const parsed = getSchema.safeParse(req.query);
  if (!parsed.success) {
    const err: ApiError = { error: '缺少 tripId', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  const userId = req.userId!;
  if (!checkOwner(parsed.data.tripId, userId, res)) return; // 坑 #22：先校验归属

  try {
    const reviews = getTripReviews(userId, parsed.data.tripId);
    res.json(reviews);
  } catch (e) {
    console.error('[reviews] 读取失败:', e);
    const err: ApiError = { error: '评价读取失败', code: 'REVIEW_READ_FAILED' };
    res.status(502).json(err);
  }
});

// 个人偏好汇总（「我的」页偏好卡片 + 闭环「被看见」）。
reviewsRouter.get('/preferences', requireAuth, (req, res) => {
  try {
    const prefs = getUserPreferences(req.userId!);
    res.json(prefs);
  } catch (e) {
    console.error('[reviews] 偏好读取失败:', e);
    const err: ApiError = { error: '偏好读取失败', code: 'PREF_READ_FAILED' };
    res.status(502).json(err);
  }
});
