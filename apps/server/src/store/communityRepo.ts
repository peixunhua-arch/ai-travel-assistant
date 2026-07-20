// 社区数据访问（community_posts + post_likes + post_favorites + post_comments）。
// 从 store.ts 拆出——纯搬代码，逻辑不变。
import { randomUUID } from 'node:crypto';
import type {
  CreateCommunityPostInput,
  CommunityPostSummary,
  CommunityPostDetail,
  CommunityComment,
  CommunityTripSnapshot,
} from '@travel/shared';
import { db } from '../db.js';
import { authorLabel, authorAvatar } from './userRepo.js';

type PostRow = {
  id: string;
  userId: string;
  postType: 'trip' | 'photo' | 'review';
  tripId: string | null;
  title: string;
  body: string;
  coverPhoto: string | null;
  tripSnapshot: string | null;
  createdAt: string;
};

function mapPostSummary(row: PostRow, viewerId: string): CommunityPostSummary {
  const likeCount = (
    db.prepare('SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?').get(row.id) as { c: number }
  ).c;
  const favoriteCount = (
    db.prepare('SELECT COUNT(*) AS c FROM post_favorites WHERE post_id = ?').get(row.id) as { c: number }
  ).c;
  const commentCount = (
    db.prepare('SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?').get(row.id) as { c: number }
  ).c;
  const likedByMe = !!db
    .prepare('SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?')
    .get(viewerId, row.id);
  const favoritedByMe = !!db
    .prepare('SELECT 1 FROM post_favorites WHERE user_id = ? AND post_id = ?')
    .get(viewerId, row.id);

  let snapshot: CommunityTripSnapshot | undefined;
  if (row.tripSnapshot) {
    try {
      snapshot = JSON.parse(row.tripSnapshot) as CommunityTripSnapshot;
    } catch {
      snapshot = undefined;
    }
  }

  const excerpt = row.body.length > 120 ? `${row.body.slice(0, 120)}…` : row.body;

  return {
    id: row.id,
    authorId: row.userId,
    authorLabel: authorLabel(row.userId),
    authorAvatar: authorAvatar(row.userId),
    type: row.postType,
    title: row.title,
    excerpt,
    coverPhoto: row.coverPhoto ?? undefined,
    destination: snapshot?.destination,
    daysCount: snapshot?.daysCount,
    likeCount,
    favoriteCount,
    commentCount,
    likedByMe: !!likedByMe,
    favoritedByMe: !!favoritedByMe,
    createdAt: row.createdAt,
  };
}

export function createCommunityPost(userId: string, input: CreateCommunityPostInput): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO community_posts
      (id, user_id, post_type, trip_id, title, body, cover_photo, trip_snapshot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    input.type,
    input.tripId ?? null,
    input.title,
    input.body,
    input.coverPhoto ?? null,
    input.tripSnapshot ? JSON.stringify(input.tripSnapshot) : null,
    now,
  );
  return id;
}

export function listCommunityPosts(
  viewerId: string,
  limit = 30,
  offset = 0,
): CommunityPostSummary[] {
  const rows = db
    .prepare(
      `SELECT id, user_id AS userId, post_type AS postType, trip_id AS tripId,
              title, body, cover_photo AS coverPhoto, trip_snapshot AS tripSnapshot,
              created_at AS createdAt
       FROM community_posts
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as PostRow[];
  return rows.map((r) => mapPostSummary(r, viewerId));
}

export function getCommunityPostDetail(
  postId: string,
  viewerId: string,
): CommunityPostDetail | null {
  const row = db
    .prepare(
      `SELECT id, user_id AS userId, post_type AS postType, trip_id AS tripId,
              title, body, cover_photo AS coverPhoto, trip_snapshot AS tripSnapshot,
              created_at AS createdAt
       FROM community_posts WHERE id = ?`,
    )
    .get(postId) as PostRow | undefined;
  if (!row) return null;

  const summary = mapPostSummary(row, viewerId);
  let tripSnapshot: CommunityTripSnapshot | undefined;
  if (row.tripSnapshot) {
    try {
      tripSnapshot = JSON.parse(row.tripSnapshot) as CommunityTripSnapshot;
    } catch {
      tripSnapshot = undefined;
    }
  }

  const comments = listPostComments(postId);

  return {
    ...summary,
    body: row.body,
    tripSnapshot,
    comments,
  };
}

export function listPostComments(postId: string): CommunityComment[] {
  const rows = db
    .prepare(
      `SELECT id, user_id AS userId, text, created_at AS createdAt
       FROM post_comments WHERE post_id = ? ORDER BY created_at ASC`,
    )
    .all(postId) as Array<{ id: string; userId: string; text: string; createdAt: string }>;

  return rows.map((r) => ({
    id: r.id,
    authorId: r.userId,
    authorLabel: authorLabel(r.userId),
    authorAvatar: authorAvatar(r.userId),
    text: r.text,
    createdAt: r.createdAt,
  }));
}

export function togglePostLike(
  userId: string,
  postId: string,
): { active: boolean; likeCount: number } | null {
  const exists = db.prepare('SELECT 1 FROM community_posts WHERE id = ?').get(postId);
  if (!exists) return null;

  const liked = db
    .prepare('SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?')
    .get(userId, postId);

  if (liked) {
    db.prepare('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
  } else {
    db.prepare('INSERT INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, ?)').run(
      userId,
      postId,
      new Date().toISOString(),
    );
  }

  const likeCount = (
    db.prepare('SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?').get(postId) as { c: number }
  ).c;
  return { active: !liked, likeCount };
}

export function togglePostFavorite(
  userId: string,
  postId: string,
): { active: boolean; favoriteCount: number } | null {
  const exists = db.prepare('SELECT 1 FROM community_posts WHERE id = ?').get(postId);
  if (!exists) return null;

  const favorited = db
    .prepare('SELECT 1 FROM post_favorites WHERE user_id = ? AND post_id = ?')
    .get(userId, postId);

  if (favorited) {
    db.prepare('DELETE FROM post_favorites WHERE user_id = ? AND post_id = ?').run(userId, postId);
  } else {
    db.prepare('INSERT INTO post_favorites (user_id, post_id, created_at) VALUES (?, ?, ?)').run(
      userId,
      postId,
      new Date().toISOString(),
    );
  }

  const favoriteCount = (
    db.prepare('SELECT COUNT(*) AS c FROM post_favorites WHERE post_id = ?').get(postId) as {
      c: number;
    }
  ).c;
  return { active: !favorited, favoriteCount };
}

export function addPostComment(
  userId: string,
  postId: string,
  text: string,
): CommunityComment | null {
  const exists = db.prepare('SELECT 1 FROM community_posts WHERE id = ?').get(postId);
  if (!exists) return null;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO post_comments (id, user_id, post_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, userId, postId, text, now);

  return {
    id,
    authorId: userId,
    authorLabel: authorLabel(userId),
    authorAvatar: authorAvatar(userId),
    text,
    createdAt: now,
  };
}

export function listUserFavoritePosts(viewerId: string): CommunityPostSummary[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.user_id AS userId, p.post_type AS postType, p.trip_id AS tripId,
              p.title, p.body, p.cover_photo AS coverPhoto, p.trip_snapshot AS tripSnapshot,
              p.created_at AS createdAt
       FROM post_favorites f
       JOIN community_posts p ON p.id = f.post_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(viewerId) as PostRow[];
  return rows.map((r) => mapPostSummary(r, viewerId));
}
