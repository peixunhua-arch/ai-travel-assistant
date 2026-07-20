// 行程的「本地存储」+「跨屏草稿」。阶段 2 行程只存这台手机（AsyncStorage），不上传后端。
//
// 两块内容：
//   A) 已保存行程的增删查（存进 AsyncStorage，杀进程/重启都还在）；
//   B) 跨屏草稿（只在内存里的一个变量，用来把「刚生成、还没保存」的行程从表单页带到预览页）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip, TripGenerateRequest, TripGenerateResponse, TripInsights } from '@travel/shared';
import { uploadTrip, fetchCloudTrips, fetchCloudTrip, cloudToSavedTrip } from './api';

// ==================== A) 已保存行程（持久化） ====================
//
// 存储方案：用「一个 key 存整个数组」。所有已保存行程序列化成一个 JSON 数组，存在 savedTrips 下。
// 为什么不给每份行程一个 key？——阶段 2 行程数量很少，一次读写整个数组最直观（初学者友好），
// 也没有性能问题。等哪天量大了再考虑分 key，那是后话。
const SAVED_TRIPS_KEY = 'savedTrips';
const tripCacheKey = (id: string) => `tripCache:${id}`;

// 生成一个本地唯一 id。不引 uuid 库——时间戳 + 随机串，撞车概率对本地小量数据可忽略。
function generateId(): string {
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 读全部已保存行程。约定「最新的在最前面」（保存时就是往数组头插的）。
// 任何异常（没存过 / JSON 坏了）都返回空数组，绝不让页面崩。
export async function listSavedTrips(): Promise<SavedTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_TRIPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SavedTrip[]) : [];
  } catch {
    return [];
  }
}

// 按 id 取一份。没有就返回 null（详情页据此显示「行程不存在」）。
export async function getSavedTrip(id: string): Promise<SavedTrip | null> {
  const all = await listSavedTrips();
  const hit = all.find((t) => t.id === id);
  if (hit) return hit;
  return getCachedTrip(id);
}

/** §6.5 离线缓存：详情页同步成功后写入 */
export async function cacheTripLocally(trip: SavedTrip): Promise<void> {
  await AsyncStorage.setItem(tripCacheKey(trip.id), JSON.stringify(trip));
}

export async function getCachedTrip(id: string): Promise<SavedTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(tripCacheKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as SavedTrip;
  } catch {
    return null;
  }
}

function buildInsights(
  trip: TripGenerateResponse,
  meta?: { travelMonth?: string; params?: TripGenerateRequest },
): TripInsights | undefined {
  const preferenceLabels = meta?.params?.preferences?.filter(Boolean);
  const insights: TripInsights = {
    personalized: trip.personalized,
    warnings: trip.warnings,
    preferenceLabels: preferenceLabels?.length ? preferenceLabels : undefined,
    usedWeather: Array.isArray(trip.weather) && trip.weather.length > 0,
    userBudget: meta?.params?.budget,
    companions: meta?.params?.companions,
    pace: meta?.params?.pace,
  };
  if (
    !insights.personalized &&
    !insights.warnings &&
    !insights.preferenceLabels?.length &&
    !insights.usedWeather &&
    (insights.userBudget == null || insights.userBudget === 0) &&
    !insights.companions &&
    !insights.pace
  ) {
    return undefined;
  }
  return insights;
}

// 保存一份新行程：给它补上 id + 保存时间，插到数组最前面，整体写回。返回补全后的对象。
//
// 阶段 3.5：本地存好后「顺带」上传一份到服务端，把返回的 serverTripId 补写回这条记录——
// 评价接口要用它。
// 顺序很关键：**先本地存**（保证「保存」永远成功，哪怕断网/服务端挂了/App 此刻被杀）；
// **再上传**。uploadTrip 是「尽力而为」（有超时、失败返回 null、不抛错），失败时本地那份照样在，
// 只是没有 serverTripId → 详情页显示「未同步，暂不能评价」。
export async function saveTrip(
  trip: TripGenerateResponse,
  meta?: { travelMonth?: string; params?: TripGenerateRequest },
): Promise<SavedTrip> {
  const saved: SavedTrip = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    destination: trip.destination,
    daysCount: trip.daysCount,
    budgetEstimate: trip.budgetEstimate,
    days: trip.days,
    travelMonth: meta?.travelMonth,
    insights: buildInsights(trip, meta),
  };
  // ① 先本地存（永远成功）
  const all = await listSavedTrips();
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify([saved, ...all]));

  // ② 再上传，成功就把 serverTripId 补写回这条记录（重新读一次，避免覆盖期间的其它变更）
  const serverTripId = await uploadTrip(trip);
  if (serverTripId) {
    saved.serverTripId = serverTripId;
    const latest = await listSavedTrips();
    await AsyncStorage.setItem(
      SAVED_TRIPS_KEY,
      JSON.stringify(latest.map((t) => (t.id === saved.id ? saved : t))),
    );
  }
  const { registerTripReminder } = await import('./proactiveAssistant');
  registerTripReminder(saved, meta?.travelMonth).catch(() => {});
  const { registerReviewReminder } = await import('./proactiveAssistant');
  registerReviewReminder(saved).catch(() => {});
  return saved;
}

// 删除一份：过滤掉该 id 后写回。
export async function deleteSavedTrip(id: string): Promise<void> {
  const all = await listSavedTrips();
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(all.filter((t) => t.id !== id)));
}

// 更新一份已保存行程（手动编辑后写回本地，UX §5.4）。
export async function updateSavedTrip(trip: SavedTrip): Promise<void> {
  const now = new Date().toISOString();
  const nextTrip: SavedTrip = { ...trip, updatedAt: now };
  const all = await listSavedTrips();
  const next = all.map((t) => (t.id === nextTrip.id ? nextTrip : t));
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));

  if (nextTrip.serverTripId) {
    const { updateCloudTrip } = await import('./api');
    const payload = {
      destination: nextTrip.destination,
      daysCount: nextTrip.daysCount,
      budgetEstimate: nextTrip.budgetEstimate,
      days: nextTrip.days,
    };
    updateCloudTrip(nextTrip.serverTripId, payload).catch(() => {});
  }
}

// §4.7 覆盖原行程：重新生成后保留原 id / serverTripId / createdAt。
export async function replaceSavedTrip(
  replaceId: string,
  trip: TripGenerateResponse,
  meta?: { travelMonth?: string; params?: TripGenerateRequest },
): Promise<SavedTrip> {
  const all = await listSavedTrips();
  const old = all.find((t) => t.id === replaceId);
  const saved: SavedTrip = {
    id: replaceId,
    createdAt: old?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    serverTripId: old?.serverTripId,
    destination: trip.destination,
    daysCount: trip.daysCount,
    budgetEstimate: trip.budgetEstimate,
    days: trip.days,
    travelMonth: meta?.travelMonth ?? old?.travelMonth,
    insights: buildInsights(trip, meta) ?? old?.insights,
  };
  const next = all.map((t) => (t.id === replaceId ? saved : t));
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(next));
  const { registerTripReminder } = await import('./proactiveAssistant');
  registerTripReminder(saved, saved.travelMonth).catch(() => {});
  return saved;
}

// 查是否有「类似」行程（同目的地 + 天数相近，UX §5.6 重复保存提示）。
export async function findSimilarTrip(
  destination: string,
  daysCount: number,
): Promise<SavedTrip | null> {
  const all = await listSavedTrips();
  return (
    all.find(
      (t) =>
        t.destination.trim() === destination.trim() &&
        Math.abs(t.daysCount - daysCount) <= 1,
    ) ?? null
  );
}

// ==================== C) 未保存预览草稿（7 天过期，UX §5.6） ====================

const PREVIEW_DRAFT_KEY = 'previewDraft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredPreviewDraft = {
  savedAt: string;
  trip: TripGenerateResponse;
  params: TripGenerateRequest;
};

export async function savePreviewDraft(
  trip: TripGenerateResponse,
  params: TripGenerateRequest,
): Promise<void> {
  const payload: StoredPreviewDraft = {
    savedAt: new Date().toISOString(),
    trip,
    params,
  };
  await AsyncStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(payload));
}

export async function getPreviewDraft(): Promise<StoredPreviewDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(PREVIEW_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredPreviewDraft;
    const age = Date.now() - new Date(data.savedAt).getTime();
    if (age > DRAFT_TTL_MS) {
      await AsyncStorage.removeItem(PREVIEW_DRAFT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// 恢复被删的行程（删除撤销用）。
export async function restoreSavedTrip(trip: SavedTrip): Promise<void> {
  const all = await listSavedTrips();
  if (all.some((t) => t.id === trip.id)) return;
  await AsyncStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify([trip, ...all]));
}

/** 未同步行程重新上传，成功返回 true 并把 serverTripId 写回本地 */
export async function resyncSavedTrip(id: string): Promise<boolean> {
  const all = await listSavedTrips();
  const trip = all.find((t) => t.id === id);
  if (!trip || trip.serverTripId) return !!trip?.serverTripId;

  const serverTripId = await uploadTrip({
    destination: trip.destination,
    daysCount: trip.daysCount,
    budgetEstimate: trip.budgetEstimate,
    days: trip.days,
  });
  if (!serverTripId) return false;

  const patched: SavedTrip = {
    ...trip,
    serverTripId,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    SAVED_TRIPS_KEY,
    JSON.stringify(all.map((t) => (t.id === id ? patched : t))),
  );
  await cacheTripLocally(patched);
  return true;
}

/** 从云端拉回本机没有的行程，返回新导入数量 */
export async function importMissingCloudTrips(): Promise<number> {
  const [local, cloudList] = await Promise.all([listSavedTrips(), fetchCloudTrips()]);
  const have = new Set(local.map((t) => t.serverTripId).filter(Boolean) as string[]);
  let imported = 0;

  for (const summary of cloudList) {
    if (have.has(summary.serverTripId)) continue;
    const detail = await fetchCloudTrip(summary.serverTripId);
    if (!detail) continue;
    const saved = cloudToSavedTrip(detail);
    await restoreSavedTrip(saved);
    have.add(summary.serverTripId);
    imported += 1;
  }
  return imported;
}

export async function clearPreviewDraft(): Promise<void> {
  await AsyncStorage.removeItem(PREVIEW_DRAFT_KEY);
}

// ==================== B) 跨屏草稿（内存，不持久化） ====================
//
// 问题：表单页点「生成行程」后要跳到预览页，得把「用户填的需求」带过去；生成成功后，
//       预览页又要拿着「生成的大 JSON」显示。怎么传？
// 不能走路由参数——Expo Router 的 params 会被序列化成 URL，装不下大对象、也不该塞大对象。
// 不用 Context——为一个临时值套一层 Provider 太重。
// 最简单的办法：一个「模块级变量」。import 进来就能读写，跳页后在新页里读一次即可。
// 代价：杀掉 App 进程草稿会没（内存嘛）——可接受，因为「已保存」的在 AsyncStorage 里，不受影响。
type Draft = { trip: TripGenerateResponse | null; params: TripGenerateRequest } | null;

let currentDraft: Draft = null;

// 存草稿。trip 传 null 表示「需求已定、还没生成」；生成成功后再调一次把 trip 填上。
export function setDraftTrip(trip: TripGenerateResponse | null, params: TripGenerateRequest): void {
  currentDraft = { trip, params };
}

// 读草稿。预览页/表单页挂载时读一次。
export function getDraftTrip(): Draft {
  return currentDraft;
}

// 清草稿。保存成功后调用，避免下次进来还带着旧草稿。
export function clearDraftTrip(): void {
  currentDraft = null;
}

// ==================== D) 乐观保存（UX §6.4） ====================
let optimisticSaving: SavedTrip | null = null;

export function setOptimisticSaving(trip: SavedTrip | null): void {
  optimisticSaving = trip;
}

export function getOptimisticSaving(): SavedTrip | null {
  return optimisticSaving;
}
