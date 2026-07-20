// 最近规划过的目的地（本地）。
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recentDestinations';
const MAX = 6;

export async function loadRecentDestinations(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export async function pushRecentDestination(city: string): Promise<void> {
  const name = city.trim();
  if (!name) return;
  const prev = await loadRecentDestinations();
  const next = [name, ...prev.filter((c) => c !== name)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
