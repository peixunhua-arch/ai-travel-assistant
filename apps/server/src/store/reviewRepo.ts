// 评价数据访问（reviews 表）。
// 包含：评价 upsert/回显 + 个人偏好聚合 + POI 社区口碑。
// 从 store.ts 拆出——纯搬代码，逻辑不变。
import { randomUUID } from 'node:crypto';
import type {
  ReviewInput,
  ReviewState,
  TripReviews,
  UserPreferences,
  PoiReputation,
} from '@travel/shared';
import { db } from '../db.js';

// tags 存的是 JSON 数组字符串，读时防御性解析（坏数据/空串一律回空数组，不让详情页崩）。
function safeParseTags(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * upsert 一条评价：同一用户对「同一行程的同一点（或整程）」重复提交就覆盖，不堆重复行。
 *
 * ⚠️ 为什么要分两条 SQL？——两个部分唯一索引（见 db.ts 坑 #19）：
 *   整程评价（poi_id 为 NULL）冲突键是 (user_id, trip_id)；
 *   单点评价（poi_id 有值）冲突键是 (user_id, trip_id, poi_id)。
 * ON CONFLICT 要点名对应的那个部分索引（带 WHERE 谓词），漏了会报「no unique constraint matching」。
 */
export function upsertReview(userId: string, input: ReviewInput): void {
  const tagsJson = JSON.stringify(input.tags ?? []);
  const comment = input.comment ?? null;
  const now = new Date().toISOString();

  if (input.poiId == null) {
    // 整程总评
    db.prepare(
      `INSERT INTO reviews (id, user_id, trip_id, poi_id, sentiment, tags, comment, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
       ON CONFLICT (user_id, trip_id) WHERE poi_id IS NULL
       DO UPDATE SET sentiment = excluded.sentiment, tags = excluded.tags,
                     comment = excluded.comment, created_at = excluded.created_at`,
    ).run(randomUUID(), userId, input.tripId, input.sentiment, tagsJson, comment, now);
  } else {
    // 单点评价
    db.prepare(
      `INSERT INTO reviews (id, user_id, trip_id, poi_id, sentiment, tags, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, trip_id, poi_id) WHERE poi_id IS NOT NULL
       DO UPDATE SET sentiment = excluded.sentiment, tags = excluded.tags,
                     comment = excluded.comment, created_at = excluded.created_at`,
    ).run(randomUUID(), userId, input.tripId, input.poiId, input.sentiment, tagsJson, comment, now);
  }
}

/**
 * 取某用户对某行程的全部评价，拆成「整程总评 + 各 POI 评价」，供详情页回显高亮。
 */
export function getTripReviews(userId: string, tripId: string): TripReviews {
  const rows = db
    .prepare(
      'SELECT poi_id AS poiId, sentiment, tags, comment FROM reviews WHERE user_id = ? AND trip_id = ?',
    )
    .all(userId, tripId) as {
    poiId: string | null;
    sentiment: number;
    tags: string;
    comment: string | null;
  }[];

  let tripReview: ReviewState | null = null;
  const poiReviews: Record<string, ReviewState> = {};

  for (const r of rows) {
    const state: ReviewState = {
      sentiment: r.sentiment === 1 ? 1 : -1,
      tags: safeParseTags(r.tags),
      comment: r.comment ?? undefined,
    };
    if (r.poiId == null) tripReview = state;
    else poiReviews[r.poiId] = state;
  }

  return { tripReview, poiReviews };
}

// ==================== 评价闭环反哺（阶段 3.5 后半） ====================

/** 聚合该用户历史评价的标签偏好，供「我的」页展示。 */
export function getUserPreferences(userId: string): UserPreferences {
  const rows = db
    .prepare(
      'SELECT sentiment, tags FROM reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    )
    .all(userId) as { sentiment: number; tags: string }[];

  const liked = new Set<string>();
  const disliked = new Set<string>();
  for (const r of rows) {
    for (const t of safeParseTags(r.tags)) {
      (r.sentiment === 1 ? liked : disliked).add(t);
    }
  }
  return {
    liked: [...liked],
    disliked: [...disliked],
    reviewCount: rows.length,
  };
}

/**
 * 拼成注入 prompt 的个人偏好段落。
 * ⚠️ 必须放进 user 消息（缓存前缀之后），不能塞进被 cache 的 system，否则 Prompt Caching 永远 miss。
 */
export function buildUserPreferenceText(userId: string): string {
  const { liked, disliked, reviewCount } = getUserPreferences(userId);
  if (reviewCount === 0) return '';

  return [
    '## 该用户的历史偏好（据其过往评价总结，请据此调整推荐）',
    liked.length ? `- 偏好：${liked.join('、')}` : '',
    disliked.length
      ? `- 避免：${disliked.join('、')}（这些是他踩过雷的点，尽量别再推类似的）`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 单个 POI 的社区口碑（无人评过返回 null）。 */
export function getPoiReputation(poiId: string): PoiReputation | null {
  const rows = db
    .prepare('SELECT sentiment, tags FROM reviews WHERE poi_id = ?')
    .all(poiId) as { sentiment: number; tags: string }[];

  if (rows.length === 0) return null;

  const likes = rows.filter((r) => r.sentiment === 1).length;
  const tagCount = new Map<string, number>();
  for (const r of rows) {
    for (const t of safeParseTags(r.tags)) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  return {
    poiId,
    reviewCount: rows.length,
    likeRatio: likes / rows.length,
    topTags,
  };
}

/** 批量查 POI 口碑（search_place 排序 + 详情页角标用）。 */
export function getReputationBatch(poiIds: string[]): Map<string, PoiReputation> {
  const unique = [...new Set(poiIds.filter(Boolean))];
  const map = new Map<string, PoiReputation>();
  for (const id of unique) {
    const rep = getPoiReputation(id);
    if (rep) map.set(id, rep);
  }
  return map;
}
