// 行程置顶 ID 列表（UX §5.3 pin 到列表顶部）。
import AsyncStorage from '@react-native-async-storage/async-storage';

const PINNED_KEY = 'pinnedTripIds';

export async function getPinnedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export async function togglePinned(id: string): Promise<boolean> {
  const pinned = await getPinnedIds();
  const isPinned = pinned.includes(id);
  const next = isPinned ? pinned.filter((x) => x !== id) : [id, ...pinned];
  await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(next));
  return !isPinned;
}

export function sortTripsWithPinned<T extends { id: string }>(
  trips: T[],
  pinnedIds: string[],
): T[] {
  if (pinnedIds.length === 0) return trips;
  const pinSet = new Set(pinnedIds);
  const pinned = pinnedIds
    .map((id) => trips.find((t) => t.id === id))
    .filter((t): t is T => !!t);
  const rest = trips.filter((t) => !pinSet.has(t.id));
  return [...pinned, ...rest];
}
