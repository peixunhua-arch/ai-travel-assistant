// 社区帖子：分享行程/照片/评价，点赞、收藏、评论。
import { Router } from 'express';
import { z } from 'zod';
import type { ApiError } from '@travel/shared';
import { requireAuth } from '../middleware/auth.js';
import {
  createCommunityPost,
  listCommunityPosts,
  getCommunityPostDetail,
  togglePostLike,
  togglePostFavorite,
  addPostComment,
  listUserFavoritePosts,
} from '../store/communityRepo.js';
import { getTripOwner } from '../store/tripRepo.js';

export const communityRouter = Router();

const tripSnapshotSchema = z.object({
  destination: z.string().min(1),
  daysCount: z.number().int().min(1),
  budgetEstimate: z.number(),
  highlightItems: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['sight', 'food', 'hotel', 'transport']),
        photoUrl: z.string().optional(),
      }),
    )
    .optional(),
});

const createSchema = z.object({
  type: z.enum(['trip', 'photo', 'review']),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(500),
  tripId: z.string().optional(),
  coverPhoto: z.string().max(600_000).optional(),
  tripSnapshot: tripSnapshotSchema.optional(),
});

const commentSchema = z.object({
  text: z.string().min(1).max(200),
});

communityRouter.get('/posts', requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  try {
    const items = listCommunityPosts(req.userId!, limit, offset);
    res.json({ items });
  } catch (e) {
    console.error('[community] 列表失败:', e);
    const err: ApiError = { error: '社区列表读取失败', code: 'COMMUNITY_LIST_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.get('/posts/favorites', requireAuth, (req, res) => {
  try {
    const items = listUserFavoritePosts(req.userId!);
    res.json({ items });
  } catch (e) {
    console.error('[community] 收藏列表失败:', e);
    const err: ApiError = { error: '收藏列表读取失败', code: 'FAVORITES_LIST_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.get('/posts/:id', requireAuth, (req, res) => {
  const postId = String(req.params.id);
  try {
    const post = getCommunityPostDetail(postId, req.userId!);
    if (!post) {
      const err: ApiError = { error: '帖子不存在', code: 'POST_NOT_FOUND' };
      return res.status(404).json(err);
    }
    res.json(post);
  } catch (e) {
    console.error('[community] 详情失败:', e);
    const err: ApiError = { error: '帖子读取失败', code: 'POST_READ_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.post('/posts', requireAuth, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '帖子内容不对', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  const userId = req.userId!;
  if (parsed.data.tripId) {
    const owner = getTripOwner(parsed.data.tripId);
    if (owner === null) {
      const err: ApiError = { error: '关联行程不存在', code: 'TRIP_NOT_FOUND' };
      return res.status(404).json(err);
    }
    if (owner !== userId) {
      const err: ApiError = { error: '只能分享你自己的行程', code: 'FORBIDDEN' };
      return res.status(403).json(err);
    }
  }

  try {
    const id = createCommunityPost(userId, parsed.data);
    res.json({ id });
  } catch (e) {
    console.error('[community] 发帖失败:', e);
    const err: ApiError = { error: '发帖失败', code: 'POST_CREATE_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.post('/posts/:id/like', requireAuth, (req, res) => {
  const postId = String(req.params.id);
  try {
    const result = togglePostLike(req.userId!, postId);
    if (!result) {
      const err: ApiError = { error: '帖子不存在', code: 'POST_NOT_FOUND' };
      return res.status(404).json(err);
    }
    res.json({ active: result.active, likeCount: result.likeCount });
  } catch (e) {
    console.error('[community] 点赞失败:', e);
    const err: ApiError = { error: '点赞失败', code: 'LIKE_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.post('/posts/:id/favorite', requireAuth, (req, res) => {
  const postId = String(req.params.id);
  try {
    const result = togglePostFavorite(req.userId!, postId);
    if (!result) {
      const err: ApiError = { error: '帖子不存在', code: 'POST_NOT_FOUND' };
      return res.status(404).json(err);
    }
    res.json({ active: result.active, favoriteCount: result.favoriteCount });
  } catch (e) {
    console.error('[community] 收藏失败:', e);
    const err: ApiError = { error: '收藏失败', code: 'FAVORITE_FAILED' };
    res.status(502).json(err);
  }
});

communityRouter.post('/posts/:id/comments', requireAuth, (req, res) => {
  const postId = String(req.params.id);
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    const err: ApiError = { error: '评论内容不对', code: 'BAD_REQUEST' };
    return res.status(400).json(err);
  }

  try {
    const comment = addPostComment(req.userId!, postId, parsed.data.text);
    if (!comment) {
      const err: ApiError = { error: '帖子不存在', code: 'POST_NOT_FOUND' };
      return res.status(404).json(err);
    }
    res.json(comment);
  } catch (e) {
    console.error('[community] 评论失败:', e);
    const err: ApiError = { error: '评论失败', code: 'COMMENT_FAILED' };
    res.status(502).json(err);
  }
});
