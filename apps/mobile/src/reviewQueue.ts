// 离线评价队列（UX §6.5 / §7.5）：断网时先入队，联网后自动补发。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewInput } from '@travel/shared';
import { postReview } from './api';

const QUEUE_KEY = 'pendingReviews';

export async function enqueueReview(input: ReviewInput): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const arr: ReviewInput[] = raw ? JSON.parse(raw) : [];
  // 同行程+同 poi 覆盖（与后端 upsert 一致）
  const key = `${input.tripId}:${input.poiId ?? 'trip'}`;
  const filtered = arr.filter((r) => `${r.tripId}:${r.poiId ?? 'trip'}` !== key);
  filtered.push(input);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export async function getPendingReviewCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/** 某行程下待同步的评价 key 集合（poiId 或 '__trip__' 表示整程） */
export async function getPendingReviewKeys(tripId: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as ReviewInput[];
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr
        .filter((r) => r.tripId === tripId)
        .map((r) => (r.poiId ? r.poiId : '__trip__')),
    );
  } catch {
    return new Set();
  }
}

/** 联网后调用：逐条 POST，成功的从队列移除。返回成功条数。 */
export async function flushReviewQueue(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  let arr: ReviewInput[] = [];
  try {
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
  } catch {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return 0;
  }

  const remain: ReviewInput[] = [];
  let okCount = 0;
  for (const item of arr) {
    const ok = await postReview(item);
    if (ok) okCount++;
    else remain.push(item);
  }
  if (remain.length === 0) await AsyncStorage.removeItem(QUEUE_KEY);
  else await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remain));
  return okCount;
}
