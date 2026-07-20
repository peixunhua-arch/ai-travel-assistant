// 从聊天自然语言里猜「规划行程」表单参数（启发式，够用即可）。
import type { TripGenerateRequest } from '@travel/shared';

const DAYS_RE = /(\d+)\s*天|玩\s*(\d+)\s*天|(\d+)\s*日游|住\s*(\d+)\s*晚/;
const BUDGET_RE = /预算\s*(\d+)\s*元|花\s*(\d+)\s*块|大约\s*(\d+)\s*元/;

const PREF_MAP: Array<{ re: RegExp; label: string }> = [
  { re: /美食|小吃|吃喝/, label: '美食' },
  { re: /亲子|带娃|小孩/, label: '亲子' },
  { re: /老人|长辈/, label: '适老' },
  { re: /穷游|便宜|省钱/, label: '省钱' },
  { re: /景点|打卡|网红/, label: '景点' },
  { re: /休闲|慢节奏|轻松/, label: '休闲' },
  { re: /徒步|户外|爬山/, label: '户外' },
];

function extractDays(text: string): number | undefined {
  const m = text.match(DAYS_RE);
  if (!m) return undefined;
  const n = Number(m[1] || m[2] || m[3] || m[4]);
  if (!Number.isFinite(n) || n < 1 || n > 14) return undefined;
  return n;
}

function extractBudget(text: string): number {
  const m = text.match(BUDGET_RE);
  if (!m) return 0;
  const n = Number(m[1] || m[2] || m[3]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function extractDestination(text: string): string | undefined {
  const patterns = [
    /帮我规划([\u4e00-\u9fa5]{2,10})(?:的)?行程/,
    /规划([\u4e00-\u9fa5]{2,10})(?:的)?行程/,
    /想去([\u4e00-\u9fa5]{2,10})/,
    /去([\u4e00-\u9fa5]{2,10})(?:玩|旅游|转转|看看|发呆|看看)/,
    /([\u4e00-\u9fa5]{2,10})\s*\d+\s*天/,
    /到([\u4e00-\u9fa5]{2,10})(?:玩|旅游)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const name = m[1]
        .replace(/的$/, '')
        .replace(/(发呆|玩玩|看看|旅游|转转|深度游)$/, '');
      if (name.length >= 2 && name.length <= 10) return name;
    }
  }
  return undefined;
}

/** 文本是否像「想生成行程」的意图（用于展示 CTA） */
export function looksLikeTripPlanIntent(text: string): boolean {
  if (!text.trim()) return false;
  if (/签证|天气|好吃|推荐美食|要带什么/.test(text) && !/行程|规划|天/.test(text)) {
    return false;
  }
  return Boolean(
    extractDestination(text) ||
      extractDays(text) ||
      /规划行程|帮我排|生成行程|行程安排/.test(text),
  );
}

/** 从一段话解析出尽量完整的 TripGenerateRequest；至少要猜到目的地 */
export function parseTripIntent(text: string): TripGenerateRequest | null {
  const destination = extractDestination(text);
  if (!destination) return null;

  const days = extractDays(text) ?? 3;
  const budget = extractBudget(text);
  const preferences = PREF_MAP.filter((p) => p.re.test(text)).map((p) => p.label);
  const prompt = text.trim().slice(0, 200);

  return {
    destination,
    days,
    budget,
    preferences,
    prompt,
  };
}
