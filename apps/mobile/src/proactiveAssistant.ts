// §16.4 主动助手：出行前本地提醒（默认关闭，用户可在「我的」开启）。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrip } from '@travel/shared';

const PROACTIVE_KEY = 'proactiveAssistantEnabled';

export async function isProactiveEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(PROACTIVE_KEY);
  return v === '1';
}

export async function setProactiveEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PROACTIVE_KEY, enabled ? '1' : '0');
  if (!enabled) {
    const { cancelAllScheduledNotifications } = await import('./notifications');
    await cancelAllScheduledNotifications();
    return;
  }
  await refreshAllReminders();
}

/** 根据 travelMonth 粗算出行日（练手项目用启发式，非精确日历） */
export function estimateTravelDate(travelMonth?: string): Date | null {
  if (!travelMonth || travelMonth === '不限') return null;
  const now = new Date();
  const year = now.getFullYear();

  const presets: Record<string, [number, number]> = {
    国庆: [10, 1],
    春节: [2, 1],
    暑假: [7, 15],
  };
  if (presets[travelMonth]) {
    const [m, d] = presets[travelMonth];
    const dt = new Date(year, m - 1, d);
    if (dt.getTime() < now.getTime()) dt.setFullYear(year + 1);
    return dt;
  }

  if (travelMonth === '下月') {
    return new Date(year, now.getMonth() + 1, 1);
  }

  const monthMatch = travelMonth.match(/^(\d{1,2})月$/);
  if (monthMatch) {
    const m = Number(monthMatch[1]);
    if (m >= 1 && m <= 12) {
      const dt = new Date(year, m - 1, 1);
      if (dt.getTime() < now.getTime()) dt.setFullYear(year + 1);
      return dt;
    }
  }

  return null;
}

/** 为单条行程注册「出行前一天 9:00」提醒 */
export async function registerTripReminder(
  trip: SavedTrip,
  travelMonth?: string,
): Promise<void> {
  if (!(await isProactiveEnabled())) return;

  const travelDate = estimateTravelDate(travelMonth);
  if (!travelDate) return;

  const remindAt = new Date(travelDate);
  remindAt.setDate(remindAt.getDate() - 1);
  remindAt.setHours(9, 0, 0, 0);
  if (remindAt.getTime() <= Date.now()) return;

  const { scheduleTravelReminder } = await import('./notifications');
  await scheduleTravelReminder({
    tripId: trip.id,
    destination: trip.destination,
    remindAt,
  });
}

/** §16.4 行程结束后温和提醒补评价（默认 3 天后 10:00） */
export async function registerReviewReminder(trip: SavedTrip): Promise<void> {
  if (!(await isProactiveEnabled())) return;
  if (!trip.serverTripId) return;

  const remindAt = new Date(trip.updatedAt ?? trip.createdAt);
  remindAt.setDate(remindAt.getDate() + 3);
  remindAt.setHours(10, 0, 0, 0);
  if (remindAt.getTime() <= Date.now()) return;

  const { scheduleTravelReminder } = await import('./notifications');
  await scheduleTravelReminder({
    tripId: `${trip.id}-review`,
    destination: trip.destination,
    remindAt,
  });
}

/** 重新扫描全部已保存行程并注册提醒 */
export async function refreshAllReminders(): Promise<void> {
  if (!(await isProactiveEnabled())) return;
  const { cancelAllScheduledNotifications } = await import('./notifications');
  const { listSavedTrips } = await import('./tripStore');
  const trips = await listSavedTrips();
  await cancelAllScheduledNotifications();
  for (const trip of trips) {
    await registerTripReminder(trip, trip.travelMonth);
    await registerReviewReminder(trip);
  }
}
