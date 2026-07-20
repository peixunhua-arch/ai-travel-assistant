// §15.2 国际化脚手架（第一版仍以中文为主，关键文案可抽离）
import zh from '../locales/zh.json';

const dict = zh as Record<string, string>;

export function t(key: string, fallback?: string): string {
  return dict[key] ?? fallback ?? key;
}
