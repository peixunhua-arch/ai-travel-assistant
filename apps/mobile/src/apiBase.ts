// 运行时可改的后端地址（AsyncStorage 持久化）。
// Release APK 装到手机后，换 WiFi / IP 变化时可在「我的」里修改，不必重打包。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE_URL } from './config';

const KEY = 'apiBaseUrl';

let cached: string = DEFAULT_API_BASE_URL;
let loaded = false;

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return cached || DEFAULT_API_BASE_URL;
}

/** 启动时调用一次；失败则回退默认地址 */
export async function loadApiBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored && /^https?:\/\//i.test(stored)) {
      cached = normalize(stored);
    } else {
      cached = DEFAULT_API_BASE_URL;
    }
  } catch {
    cached = DEFAULT_API_BASE_URL;
  }
  loaded = true;
  return cached;
}

export async function setApiBaseUrl(url: string): Promise<string> {
  const next = normalize(url);
  if (!/^https?:\/\/.+/i.test(next)) {
    throw new Error('请输入以 http:// 或 https:// 开头的地址，例如 http://192.168.1.8:3000');
  }
  const prev = cached;
  cached = next;
  await AsyncStorage.setItem(KEY, next);
  loaded = true;
  // 换后端后旧 JWT 失效，清掉以便下次重新登录
  if (prev !== next) {
    try {
      await AsyncStorage.removeItem('token');
    } catch {
      /* ignore */
    }
  }
  return next;
}

export async function resetApiBaseUrl(): Promise<string> {
  const prev = cached;
  cached = DEFAULT_API_BASE_URL;
  await AsyncStorage.removeItem(KEY);
  if (prev !== cached) {
    try {
      await AsyncStorage.removeItem('token');
    } catch {
      /* ignore */
    }
  }
  return cached;
}

export function isApiBaseLoaded(): boolean {
  return loaded;
}

export { DEFAULT_API_BASE_URL };
