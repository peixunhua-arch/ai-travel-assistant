// 旅行画像 + 本机个性设置（与评价偏好互补，可同步到规划表单）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip, TripGenerateRequest } from '@travel/shared';

const PORTRAIT_KEY = 'travelPortrait_v1';
const SIGNATURE_KEY = 'userSignature_v1';

export const PREFERENCE_CHIP_OPTIONS = [
  '美食',
  '自然',
  '轻松',
  '打卡',
  '购物',
  '康养慢游',
  '人文古迹',
  '徒步爬山',
  '夜景',
  '本地人多',
] as const;

export const COMPANION_CHIP_OPTIONS: {
  label: string;
  value: NonNullable<TripGenerateRequest['companions']>;
}[] = [
  { label: '常独自出行', value: 'solo' },
  { label: '情侣结伴', value: 'couple' },
  { label: '亲子同行', value: 'family' },
  { label: '带老人', value: 'elder' },
  { label: '朋友结伴', value: 'friends' },
];

export type TravelPortrait = {
  preferences: string[];
  companions?: TripGenerateRequest['companions'];
  /** true = 偏小众；false = 偏网红热门 */
  nicheRecommend: boolean;
  cloudAutoSync: boolean;
  personalizationAuth: boolean;
};

const DEFAULT_PORTRAIT: TravelPortrait = {
  preferences: [],
  nicheRecommend: false,
  cloudAutoSync: true,
  personalizationAuth: true,
};

export async function loadSignature(): Promise<string> {
  return (await AsyncStorage.getItem(SIGNATURE_KEY)) ?? '';
}

export async function saveSignature(text: string): Promise<void> {
  await AsyncStorage.setItem(SIGNATURE_KEY, text.trim().slice(0, 40));
}

export async function loadTravelPortrait(): Promise<TravelPortrait> {
  try {
    const raw = await AsyncStorage.getItem(PORTRAIT_KEY);
    if (!raw) return { ...DEFAULT_PORTRAIT };
    const parsed = JSON.parse(raw) as Partial<TravelPortrait>;
    return {
      ...DEFAULT_PORTRAIT,
      ...parsed,
      preferences: Array.isArray(parsed.preferences)
        ? parsed.preferences.filter((p): p is string => typeof p === 'string')
        : [],
    };
  } catch {
    return { ...DEFAULT_PORTRAIT };
  }
}

export async function saveTravelPortrait(next: TravelPortrait): Promise<void> {
  await AsyncStorage.setItem(PORTRAIT_KEY, JSON.stringify(next));
}

export type TravelStats = {
  tripCount: number;
  cityCount: number;
  totalDays: number;
  reviewCount: number;
};

export function computeTravelStats(trips: SavedTrip[], reviewCount: number): TravelStats {
  const cities = new Set(
    trips.map((t) => t.destination.trim()).filter((d) => d.length > 0),
  );
  const totalDays = trips.reduce((sum, t) => sum + (t.daysCount || 0), 0);
  return {
    tripCount: trips.length,
    cityCount: cities.size,
    totalDays,
    reviewCount,
  };
}

/** 从已保存行程推断常用结伴（画像未填时兜底展示） */
export function inferCompanionFromTrips(
  trips: SavedTrip[],
): TripGenerateRequest['companions'] | undefined {
  const counts = new Map<NonNullable<TripGenerateRequest['companions']>, number>();
  for (const t of trips) {
    const c = t.insights?.companions;
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: TripGenerateRequest['companions'] | undefined;
  let n = 0;
  for (const [k, v] of counts) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}

export function companionLabel(
  value?: TripGenerateRequest['companions'],
): string | undefined {
  if (!value) return undefined;
  return COMPANION_CHIP_OPTIONS.find((c) => c.value === value)?.label;
}

export function buildAnnualReportSummary(trips: SavedTrip[]): {
  cities: string[];
  prefs: string[];
  totalDays: number;
  tripCount: number;
  paceHint: string;
} {
  const cityMap = new Map<string, number>();
  const prefMap = new Map<string, number>();
  let totalDays = 0;
  const paceCounts = { relaxed: 0, moderate: 0, packed: 0 };

  for (const t of trips) {
    totalDays += t.daysCount || 0;
    if (t.destination) cityMap.set(t.destination, (cityMap.get(t.destination) ?? 0) + 1);
    for (const p of t.insights?.preferenceLabels ?? []) {
      prefMap.set(p, (prefMap.get(p) ?? 0) + 1);
    }
    const pace = t.insights?.pace;
    if (pace) paceCounts[pace] += 1;
  }

  const cities = [...cityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, 6);
  const prefs = [...prefMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
    .slice(0, 5);

  let paceHint = '节奏均衡，玩得尽兴也不赶场';
  if (paceCounts.relaxed >= paceCounts.moderate && paceCounts.relaxed >= paceCounts.packed) {
    paceHint = '偏爱慢旅行，留足发呆与美食时间';
  } else if (paceCounts.packed > paceCounts.moderate) {
    paceHint = '特种兵体质，喜欢把行程排满';
  }

  return {
    cities,
    prefs,
    totalDays,
    tripCount: trips.length,
    paceHint,
  };
}
