// 行程规划共享：提示词、Zod schema、工具执行、POI 回填。
// 供 DeepSeek / Claude 等 Agent 实现复用，与具体厂商 SDK 解耦。
import { z } from 'zod';
import type { TripGenerateRequest, TripWarnings, WeatherDay } from '@travel/shared';
import { getWeather } from '../weather.js';
import { searchPlace, type Poi } from '../places.js';
import { buildLinks } from '../links.js';
import { buildUserPreferenceText, getReputationBatch } from '../../store/reviewRepo.js';

export const TRIP_SYSTEM_PROMPT = [
  '你是「途灵」的资深旅游规划大师，从业 15 年，擅长国内深度游与短途可执行行程。',
  '你的风格：像一位既懂审美又懂落地的老规划师——不堆清单、不灌鸡汤，给出「今天为什么这么排、怎么走更顺、哪里值得停」的判断。',
  '',
  '【核心原则】',
  '1. 可执行优先：时间、动线、餐饮、住宿、天气都要能落地，不安排幻想中的点。',
  '2. 动线优先于清单：同城同片区连片安排，减少折返；跨片区必须写清交通衔接。',
  '3. 节奏匹配用户：轻松/适中/特种兵要体现在每日密度与休息空档。',
  '4. 同行人适配：亲子偏安全短途；老人少爬坡少换乘；情侣偏氛围；朋友可夜生活与活动。',
  '5. 预算诚实：budgetEstimate 与档次相符；贵的点要写清「贵在哪、值不值」。',
  '6. 本地感：优先有社区口碑、有特色的店，少推连锁网红流水席（除非用户点名）。',
  '7. description 要像规划师旁白：一句说清「为什么去 / 吃什么 / 注意什么」，别写空话。',
  '',
  '【工具——必须先用工具查真实数据，别凭空想】',
  '- get_weather(city)：查目的地未来天气，据此安排室内外活动（下雨多排室内；高温避开正午暴晒）。',
  '- search_place(city, keyword, type)：搜真实的餐厅/景点/酒店。规划里每一个 sight/food/hotel',
  '  都必须从 search_place 返回的结果中挑选，并带上它的 poiId。禁止凭空编造店名或 poiId。',
  '  结果里可能有 community 字段（社区口碑）：likeRatio 高的优先，topTags 含负面标签的谨慎推荐。',
  '- 请先调用这些工具收集数据（可多次、多关键词），数据齐了再输出最终行程。',
  '',
  '【输出格式——必须严格遵守】',
  '只输出一个 JSON 对象，不要输出任何解释、前言、后记，也不要用 ```json 代码块包裹。',
  'JSON 结构如下：',
  '{',
  '  "destination": "目的地名（字符串）",',
  '  "budgetEstimate": 整数（这趟行程的预算估算，单位元，不含往返大交通）,',
  '  "days": [',
  '    {',
  '      "day": 整数（第几天，从 1 开始）,',
  '      "theme": "当天主题（一句话，有叙事感，如：老城烟火与夜间市集）",',
  '      "items": [',
  '        {',
  '          "time": "HH:MM（24 小时制，如 09:30）",',
  '          "name": "地点或活动名称（与所选 POI 一致）",',
  '          "type": "四选一：sight（景点）/ food（餐饮）/ hotel（住宿）/ transport（交通）",',
  '          "description": "一句话说明，为什么去/吃什么/注意什么",',
  '          "poiId": "该地点在 search_place 结果里的 poiId（sight/food/hotel 必填；transport 可省略）"',
  '        }',
  '      ]',
  '    }',
  '  ]',
  '}',
  '',
  '【内容要求】',
  '- 天数必须与用户要求一致；每天安排 4~6 个 items，按时间先后排列。',
  '- 合理穿插景点、餐饮（三餐）、必要交通；行程节奏别太赶；一天不要塞满无法完成的重景点。',
  '- 相邻 items 默认步行/地铁可达；超过约 40 分钟必须插一条 transport，并写清方式。',
  '- 每天至少 1 处「本地人更爱」的餐饮或小众点（必须来自 search_place）。',
  '- 若偏好冲突（如特种兵+带老人），以安全与可达性为准并体现在安排里。',
  '- 尊重用户的预算与偏好；budgetEstimate 要和预算档次相称。',
  '- 若用户给了出行月份，优先排当季体验。',
  '- 所有文字用简体中文。',
  '- 只输出 poiId 这一个「真实数据」字段；绝对不要输出 lat、lng、rating、address、links、dataSources',
  '  （这些由后端按 poiId 回填，你没有精确值，不要编）。',
].join('\n');

export const FINAL_INSTRUCTION =
  '工具数据已收集完毕。现在请从 search_place 返回的 POI 中选点，' +
  '每个 sight/food/hotel 必须带上对应 poiId，直接输出最终行程 JSON（只输出 JSON，不要任何解释或代码块包裹）。';

export const RETRY_JSON_INSTRUCTION =
  '上面的输出不是合法 JSON，请只输出符合要求的 JSON 对象，不要任何多余文字或代码块包裹。';

/** OpenAI / DeepSeek Function Calling 工具声明 */
export const OPENAI_TRIP_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: '查询指定城市未来 3 天天气预报，用于安排室内外活动',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名，如「成都」' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_place',
      description:
        '搜索高德真实 POI（餐厅/景点/酒店）。规划时必须从返回列表中选点，并在行程里带上对应 poiId',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名，如「成都」' },
          keyword: { type: 'string', description: '搜索词，如「川菜」「宽窄巷子」' },
          type: {
            type: 'string',
            enum: ['food', 'sight', 'hotel'],
            description: 'POI 类型',
          },
        },
        required: ['city', 'keyword', 'type'],
      },
    },
  },
];

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

const tripItemSchema = z.object({
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
  name: z.string().min(1),
  type: z.enum(['sight', 'food', 'hotel', 'transport'] as const),
  description: z.string().min(1),
  poiId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  rating: z.number().optional(),
  address: z.string().optional(),
  photoUrl: z.string().optional(),
  opentime: z.string().optional(),
  links: z
    .object({
      dianpingUrl: z.string(),
      xhsUrl: z.string(),
      mapUrl: z.string(),
      xhsScheme: z.string(),
      dianpingScheme: z.string(),
    })
    .optional(),
  dataSources: z
    .object({
      place: z.enum(['amap', 'ai']),
      description: z.literal('ai'),
      external: z.literal('search_only'),
    })
    .optional(),
});
const tripDaySchema = z.object({
  day: z.number().int().min(1),
  theme: z.string().min(1),
  items: z.array(tripItemSchema).min(1),
});
export const tripSchema = z.object({
  destination: z.string().min(1),
  budgetEstimate: z.number().int().min(0),
  days: z.array(tripDaySchema).min(1),
});

export type ParsedTrip = z.infer<typeof tripSchema>;

export interface ToolCtx {
  poiCache: Map<string, Poi>;
  weather: WeatherDay[] | null;
}

export async function executeTool(name: string, input: unknown, ctx: ToolCtx): Promise<string> {
  if (name === 'get_weather') {
    const city = (input as { city?: string }).city ?? '';
    const { days, summary } = await getWeather(city);
    ctx.weather = days;
    return summary;
  }
  if (name === 'search_place') {
    const arg = input as { city?: string; keyword?: string; type?: 'food' | 'sight' | 'hotel' };
    const pois = await searchPlace(arg.city ?? '', arg.keyword ?? '', arg.type ?? 'sight');
    for (const p of pois) ctx.poiCache.set(p.poiId, p);
    const repMap = getReputationBatch(pois.map((p) => p.poiId));
    return JSON.stringify({
      pois: pois.map((p) => ({
        poiId: p.poiId,
        name: p.name,
        address: p.address,
        rating: p.rating,
        type: p.type,
        community: repMap.get(p.poiId) ?? null,
      })),
    });
  }
  return `未知工具：${name}`;
}

export function enrichTrip(trip: ParsedTrip, poiCache: Map<string, Poi>): ParsedTrip {
  const cacheEmpty = poiCache.size === 0;
  for (const day of trip.days) {
    for (const item of day.items) {
      // 推荐理由始终是 AI；外链（若有）仅为站外搜索入口，不是抓取来源。
      if (item.type === 'transport') {
        item.dataSources = { place: 'ai', description: 'ai', external: 'search_only' };
        continue;
      }
      if (cacheEmpty) {
        item.dataSources = { place: 'ai', description: 'ai', external: 'search_only' };
        continue;
      }
      const poi = item.poiId ? poiCache.get(item.poiId) : undefined;
      if (!poi) {
        item.dataSources = { place: 'ai', description: 'ai', external: 'search_only' };
        continue;
      }
      item.name = poi.name;
      item.lat = poi.lat;
      item.lng = poi.lng;
      if (poi.rating !== undefined) item.rating = poi.rating;
      if (poi.address) item.address = poi.address;
      if (poi.photoUrl) item.photoUrl = poi.photoUrl;
      if (poi.opentime) item.opentime = poi.opentime;
      item.links = buildLinks(poi.name, trip.destination);
      item.dataSources = { place: 'amap', description: 'ai', external: 'search_only' };
    }
  }
  return trip;
}

export function computeWarnings(trip: ParsedTrip): TripWarnings {
  let unenrichedCount = 0;
  let totalPlaces = 0;
  const sparseDays: number[] = [];
  for (const day of trip.days) {
    let dayPlaces = 0;
    for (const item of day.items) {
      if (item.type === 'transport') continue;
      totalPlaces++;
      dayPlaces++;
      if (!item.links) unenrichedCount++;
    }
    if (dayPlaces <= 1) sparseDays.push(day.day);
  }
  return { unenrichedCount, totalPlaces, sparseDays };
}

export function buildTripUserMessage(req: TripGenerateRequest): string {
  const budgetLine = req.budget > 0 ? `预算：约 ${req.budget} 元/人` : '预算：不限';
  const prefLine =
    req.preferences.length > 0 ? `偏好：${req.preferences.join('、')}` : '偏好：无特别偏好';
  const extraLine = req.prompt ? `补充要求：${req.prompt}` : '';
  const monthLine = req.travelMonth ? `出行时间：${req.travelMonth}` : '';
  const companionMap = {
    solo: '独自',
    couple: '情侣',
    family: '亲子',
    elder: '带老人',
    friends: '朋友结伴',
  } as const;
  const companionLine = req.companions ? `同行人：${companionMap[req.companions]}` : '';
  const paceMap = { relaxed: '轻松', moderate: '适中', packed: '特种兵' } as const;
  const paceLine = req.pace ? `节奏：${paceMap[req.pace]}` : '';
  const departLine = req.departureCity ? `出发城市：${req.departureCity}` : '';
  return [
    `目的地：${req.destination}`,
    `天数：${req.days} 天`,
    budgetLine,
    prefLine,
    monthLine,
    companionLine,
    paceLine,
    departLine,
    extraLine,
    '',
    '请以资深规划师视角输出：每天 theme 要有叙事感；description 写清为什么去/注意什么；动线顺、节奏匹配用户。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function withUserPreferences(
  userMessage: string,
  userId?: string,
): { content: string; personalized: boolean } {
  const preferenceText = userId ? buildUserPreferenceText(userId) : '';
  const personalized = preferenceText.length > 0;
  return {
    content: preferenceText ? `${userMessage}\n\n${preferenceText}` : userMessage,
    personalized,
  };
}

export type TripGenerateResult = {
  trip: ParsedTrip;
  weather: WeatherDay[] | null;
  personalized: boolean;
  warnings: TripWarnings;
};

export type ImageInput = { base64: string; mediaType: 'image/jpeg' | 'image/png' };
