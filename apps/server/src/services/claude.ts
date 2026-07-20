// 封装 Claude 调用。阶段 1 只用最简单的一问一答；阶段 2 加「结构化生成行程」。
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { TripGenerateRequest, TripWarnings, WeatherDay } from '@travel/shared';
import { getWeather } from './weather.js';
import { searchPlace, type Poi } from './places.js';
import { buildLinks } from './links.js';
import { buildUserPreferenceText, getReputationBatch } from '../store/reviewRepo.js';

// 用 CLAUDE_* 自定义前缀，而不是 SDK 默认的 ANTHROPIC_*：
// 这台机器全局设了 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN（Claude Code 自己在用），
// 如果后端也依赖这些名字，以后想换成自己的 key 时会被全局值静默覆盖、极难排查。
// 所以这里显式读 CLAUDE_* 并手动传进构造函数，让后端和全局环境完全解耦。
const authToken = process.env.CLAUDE_AUTH_TOKEN; // 网关用 Bearer 令牌
const apiKey = process.env.CLAUDE_API_KEY; // 官方直连用 sk-ant- key（二选一）
// 显式定 baseURL：填了就用网关；没填就写死官方地址，而不是让 SDK 回落去读
// 全局的 ANTHROPIC_BASE_URL（那样会把"想直连官方"的请求又偷偷送回课程网关）。
const baseURL = process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com';

const client = new Anthropic({
  baseURL,
  authToken: authToken ?? null, // 有 Bearer 令牌就用它
  apiKey: apiKey ?? null, // 否则用官方 key
});

// 模型 ID：课程网关目前只支持 Opus/Sonnet 4.x，没有 Haiku，所以用 Sonnet-4.6。
// （以后切到自己的 key 直连官方时，可按需换回更便宜的 Haiku。）
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

// 旅游助手的系统人设（阶段 1 先简单写，够长才能吃到 Prompt Caching，后续再扩）
const SYSTEM_PROMPT =
  '你是一个专业、热心的中文旅游助手。回答要简洁实用，重点突出。' +
  '涉及签证、天气、安全等信息时，提醒用户以官方渠道为准。';

function extractText(content: Anthropic.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('Claude 未返回文本');
  }
  return block.text;
}

type ImageInput = { base64: string; mediaType: 'image/jpeg' | 'image/png' };

function buildUserContent(
  userMessage: string,
  image?: ImageInput,
): string | Anthropic.MessageParam['content'] {
  if (!image) return userMessage;
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.base64,
      },
    },
    { type: 'text', text: userMessage },
  ];
}

/** 普通对话：一句问，一句答（支持 §16.1 图片） */
export async function ask(
  userMessage: string,
  image?: ImageInput,
): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserContent(userMessage, image) }],
  });
  return extractText(res.content);
}

/**
 * 流式对话（UX §8.1 SSE）：每收到一段文本就回调 onDelta，最后返回完整回复。
 */
export async function askStream(
  userMessage: string,
  onDelta: (text: string) => void,
  image?: ImageInput,
): Promise<string> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserContent(userMessage, image) }],
  });

  let full = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      full += event.delta.text;
      onDelta(event.delta.text);
    }
  }
  return full;
}

// 打印一次调用的缓存命中情况（阶段 4：Prompt Caching 观测用）。
//   write = cache_creation_input_tokens：这次「写进缓存」的 token（第一次建缓存时 > 0，贵 25%）
//   read  = cache_read_input_tokens：这次「命中缓存、按 10% 计费」的 token（后续每次应 > 0）
//   miss  = input_tokens：没走缓存、全价计费的 token（每次那点变化的 messages）
// 一次生成会打印十几行；只要第 2 行起 read 持续 > 0，就说明缓存生效、tools+system 那段在省钱。
function logCache(tag: string, usage: Anthropic.Usage): void {
  const write = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  console.log(`[trip][cache] ${tag} 写缓存=${write} 读缓存=${read} 全价=${usage.input_tokens}`);
}

// ==================== 阶段 3：Agent（工具调用）+ 真实数据回填 ====================
//
// 阶段 2 是「纯生成」：Claude 凭知识编行程，没有真实坐标/评分。阶段 3 升级成「Agent」：
//   Phase A（工具轮）：让 Claude 主动调 get_weather / search_place 查真实天气和 POI，
//                      后端执行工具、把结果喂回，循环最多 10 轮。
//   收尾指令：追加进最后一条 user 消息（不能新开 user，否则报 roles must alternate）。
//   Phase B（收尾轮）：让 Claude 吐最终行程 JSON（非交通项要带它从 search_place 选的 poiId），
//                      仍走「extractJson → JSON.parse → Zod 校验」+ 重试（最多 3 次）。
//   enrichTrip：后端按 poiId 回填真实 lat/lng/rating/address + 拼跳转链接。
//
// 为什么收尾还是手动 Zod，不用 SDK 的 messages.parse / zodOutputFormat？
//   —— 已核实当前 @anthropic-ai/sdk@0.68.0 根本没有这两个 API。技术方案 §6.3 的 Phase B
//   示例代码在本 SDK 上跑不了，所以沿用阶段 2 已跑通的手动兜底那套（最稳、零新依赖）。

// 行程专用系统提示词。阶段 3 改动：告诉模型「有工具可用」+「非交通项必须带 poiId」。
const TRIP_SYSTEM_PROMPT = [
  '你是专业的中文旅游行程规划师。根据用户给的目的地、天数、预算、偏好，生成一份可执行的每日行程。',
  '',
  '【工具——必须先用工具查真实数据，别凭空想】',
  '- get_weather(city)：查目的地未来天气，据此安排室内外活动（下雨多排室内）。',
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
  '      "theme": "当天主题（一句话，如：老城区人文漫步）",',
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
  '- 合理穿插景点、餐饮（三餐）、必要交通；行程节奏别太赶。',
  '- 尊重用户的预算与偏好；budgetEstimate 要和预算档次相称。',
  '- 所有文字用简体中文。',
  '- 只输出 poiId 这一个「真实数据」字段；绝对不要输出 lat、lng、rating、address、links',
  '  （这些由后端按 poiId 回填，你没有精确值，不要编）。',
].join('\n');

// Prompt Caching 用的 system（阶段 4）。把断点打在 system 而不是 tools 上，原因是：
//   缓存断点会缓存「从请求开头到断点」的整段，顺序是 tools → system → messages。
//   Anthropic 有个「被缓存前缀至少约 1024 token 才生效、不够就静默忽略」的门槛：
//   只打在 tools 上 → 仅缓存 tools（约 300 token）< 门槛 → 不生效（实测读缓存一直=0）；
//   打在 system 末尾 → 缓存 tools + 整段 system（约 1500 token）> 门槛 → 生效。
//   这段 tools+system 每次请求完全一样，一次生成要调十几次，第 2 次起就按 10% 读缓存计费。
const TRIP_SYSTEM_CACHED: Anthropic.TextBlockParam[] = [
  { type: 'text', text: TRIP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
];

// 两个工具的声明（给 Claude 看的「说明书」，让它知道有啥工具、怎么传参）。
const getWeatherTool: Anthropic.Tool = {
  name: 'get_weather',
  description: '查询指定城市未来 3 天天气预报，用于安排室内外活动',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名，如「成都」' },
    },
    required: ['city'],
  },
};
const searchPlaceTool: Anthropic.Tool = {
  name: 'search_place',
  description:
    '搜索高德真实 POI（餐厅/景点/酒店）。规划时必须从返回列表中选点，并在行程里带上对应 poiId',
  input_schema: {
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
};
const TOOLS = [getWeatherTool, searchPlaceTool];

// 从模型返回的文本里把 JSON 抠出来：
//   模型有时会不听话地用 ```json ... ``` 包起来，这里用正则先剥掉围栏；
//   剥不到就当整段都是 JSON，去掉首尾空白返回。
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

// Zod 校验形状（zod v4：z.enum 要加 as const，否则会被推断成 string[] 报类型错）。
// 这几个 optional 字段（poiId...links）阶段 2 模型不产出，但留着以便阶段 3 兼容；
// 校验放宽——就算模型手贱多塞了，也不因此判定失败。
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
  photoUrl: z.string().optional(), // 后端 enrichTrip 回填高德首图（Claude 不产出）
  opentime: z.string().optional(),
  // links 由后端 enrichTrip 回填（Claude 不产出）；这里写全 5 字段只为让推断类型带上，
  // 好让 enrichTrip 里 item.links = buildLinks(...) 赋值时类型对得上。
  links: z
    .object({
      dianpingUrl: z.string(),
      xhsUrl: z.string(),
      mapUrl: z.string(),
      xhsScheme: z.string(),
      dianpingScheme: z.string(),
    })
    .optional(),
});
const tripDaySchema = z.object({
  day: z.number().int().min(1),
  theme: z.string().min(1),
  items: z.array(tripItemSchema).min(1),
});
const tripSchema = z.object({
  destination: z.string().min(1),
  budgetEstimate: z.number().int().min(0),
  days: z.array(tripDaySchema).min(1),
});

// 校验通过后的行程类型（enrichTrip 就地改它）。
type ParsedTrip = z.infer<typeof tripSchema>;

// Agent 跑一趟的「上下文」：工具执行时把结果攒在这里，供后面 enrichTrip / 挂天气用。
interface ToolCtx {
  poiCache: Map<string, Poi>; // poiId → 真实 POI（供按 poiId 回填坐标/评分/地址）
  weather: WeatherDay[] | null; // get_weather 拿到的 3 天预报
}

// 执行一个工具，返回「喂回给 Claude 的文本」。副作用：把数据攒进 ctx。
async function executeTool(name: string, input: unknown, ctx: ToolCtx): Promise<string> {
  if (name === 'get_weather') {
    const city = (input as { city?: string }).city ?? '';
    const { days, summary } = await getWeather(city);
    ctx.weather = days; // 存结构化数据，最后挂到响应上给前端画天气条
    return summary; // 只把一句话摘要喂回模型，够它决策了
  }
  if (name === 'search_place') {
    const arg = input as { city?: string; keyword?: string; type?: 'food' | 'sight' | 'hotel' };
    const pois = await searchPlace(arg.city ?? '', arg.keyword ?? '', arg.type ?? 'sight');
    for (const p of pois) ctx.poiCache.set(p.poiId, p);
    const repMap = getReputationBatch(pois.map((p) => p.poiId));
    // 喂回给 Claude：带上 poiId + 社区口碑（community.likeRatio 高的优先，负面 topTags 谨慎推荐）。
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

// 把一轮里 Claude 请求的所有工具都执行掉，并把「assistant 那轮 + 工具结果」按顺序 push 进 messages。
// 工具失败不崩：包成 is_error 的 tool_result 喂回去，让模型自己知道并换个查法。
async function runToolRound(
  res: Anthropic.Message,
  ctx: ToolCtx,
  messages: Anthropic.MessageParam[],
): Promise<void> {
  messages.push({ role: 'assistant', content: res.content });
  const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
    toolUses.map(async (tu) => {
      try {
        return { type: 'tool_result' as const, tool_use_id: tu.id, content: await executeTool(tu.name, tu.input, ctx) };
      } catch (e) {
        console.warn(`[trip] 工具 ${tu.name} 执行失败:`, e);
        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: `工具执行失败：${(e as Error)?.message ?? '未知错误'}`,
          is_error: true,
        };
      }
    }),
  );
  messages.push({ role: 'user', content: toolResults });
}

// 按 poiId 回填真实数据。原则见计划「关键风险 7」：宁可保留不回填，也别把整天删空。
function enrichTrip(trip: ParsedTrip, poiCache: Map<string, Poi>): ParsedTrip {
  const cacheEmpty = poiCache.size === 0; // 工具全失败时缓存为空——那就全部保留、不回填，行程仍可读
  for (const day of trip.days) {
    for (const item of day.items) {
      if (item.type === 'transport') continue; // 交通项本就不需要 POI
      if (cacheEmpty) continue;
      const poi = item.poiId ? poiCache.get(item.poiId) : undefined;
      if (!poi) continue; // 没命中（模型没给 poiId 或给错）：保留 name/description，只是它不上地图
      // 命中：用真实数据覆盖，并拼跳转链接。
      item.name = poi.name;
      item.lat = poi.lat;
      item.lng = poi.lng;
      if (poi.rating !== undefined) item.rating = poi.rating;
      if (poi.address) item.address = poi.address;
      if (poi.photoUrl) item.photoUrl = poi.photoUrl; // 高德首图（有才填）
      if (poi.opentime) item.opentime = poi.opentime;
      item.links = buildLinks(poi.name, trip.destination);
    }
  }
  return trip;
}

/** §6.3：统计未回填 POI 与过空天数，供前端透明提示 */
function computeWarnings(trip: ParsedTrip): TripWarnings {
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

/**
 * 结构化生成行程（阶段 3：Agent + 工具 + 真实数据回填）。
 * 成功：返回 { trip, weather }，trip 已按 poiId 回填坐标/评分/地址/链接。
 * 失败：抛「普通对象」（不是 Error 实例！路由层用 e as {code} 接，别用 instanceof）：
 *   - { code: 'CLAUDE_ERROR' }        Claude 调用本身报错——不重试，直接抛
 *   - { code: 'TRIP_PARSE_FAILED' }   收尾轮连试 3 次都解析/校验不过——才抛这个
 */
export async function generateTrip(
  req: TripGenerateRequest,
  userId?: string,
): Promise<{ trip: ParsedTrip; weather: WeatherDay[] | null; personalized: boolean; warnings: TripWarnings }> {
  // 把结构化请求拼成一段自然语言，喂给模型。budget===0 表示用户选了「不限」。
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
  const userMessage = [
    `目的地：${req.destination}`,
    `天数：${req.days} 天`,
    budgetLine,
    prefLine,
    monthLine,
    companionLine,
    paceLine,
    departLine,
    extraLine,
  ]
    .filter(Boolean)
    .join('\n');

  // 个人闭环：偏好放进 user 消息（不能塞进被 cache 的 system 前缀）。
  const preferenceText = userId ? buildUserPreferenceText(userId) : '';
  const personalized = preferenceText.length > 0;
  const initialContent = preferenceText ? `${userMessage}\n\n${preferenceText}` : userMessage;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: initialContent }];
  const ctx: ToolCtx = { poiCache: new Map(), weather: null };

  // ---------- Phase A：工具轮（最多 10 轮，防死循环烧钱）----------
  for (let round = 0; round < 10; round++) {
    let res: Anthropic.Message;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: 4096, // 工具轮不吐大 JSON，4096 够
        system: TRIP_SYSTEM_CACHED,
        tools: TOOLS,
        messages,
      });
    } catch (e) {
      console.error('[trip] Claude 调用失败(Phase A):', e);
      throw { code: 'CLAUDE_ERROR', message: (e as Error)?.message };
    }
    logCache(`A#${round}`, res.usage);
    if (res.stop_reason === 'tool_use') {
      await runToolRound(res, ctx, messages); // 执行工具、喂回，进入下一轮
      continue;
    }
    // 其它（end_turn / max_tokens…）都视作「不再调工具」，跳出去收尾。
    break;
  }

  // ---------- 收尾指令：追加进「最后一条 user 消息」----------
  // ⚠️ 硬约束②：此刻 messages 最后一条一定是 user（tool_result 数组，或最初的字符串）。
  //   绝不能再 push 一条 user（会 400: roles must alternate）。把指令作为 text block 追加进去。
  const last = messages[messages.length - 1];
  const finalInstruction: Anthropic.TextBlockParam = {
    type: 'text',
    text:
      '工具数据已收集完毕。现在请从 search_place 返回的 POI 中选点，' +
      '每个 sight/food/hotel 必须带上对应 poiId，直接输出最终行程 JSON（只输出 JSON，不要任何解释或代码块包裹）。',
  };
  last.content = Array.isArray(last.content)
    ? [...last.content, finalInstruction]
    : [{ type: 'text', text: last.content } as Anthropic.TextBlockParam, finalInstruction];

  // ---------- Phase B：收尾轮，拿最终 JSON（手动 extractJson + Zod + 重试）----------
  // 循环给点余量（最多 6 次）：模型可能在收尾时还想补查工具；解析失败最多容忍 3 次。
  let parseFailures = 0;
  let lastParseError: unknown = null;
  for (let i = 0; i < 6; i++) {
    let res: Anthropic.Message;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: 8192, // 多天行程 JSON 很长，必须给足，否则被截断→解析必败
        system: TRIP_SYSTEM_CACHED,
        tools: TOOLS, // 仍带着，万一它还想补查
        messages,
      });
    } catch (e) {
      console.error('[trip] Claude 调用失败(Phase B):', e);
      throw { code: 'CLAUDE_ERROR', message: (e as Error)?.message };
    }
    logCache(`B#${i}`, res.usage);

    // 模型还想调工具：执行、喂回，继续（不算一次解析失败）。
    if (res.stop_reason === 'tool_use') {
      await runToolRound(res, ctx, messages);
      continue;
    }

    // 否则拿文本解析。
    let text = '';
    try {
      text = extractText(res.content);
    } catch {
      text = '';
    }
    try {
      const json = JSON.parse(extractJson(text));
      const trip = tripSchema.parse(json);
      const enriched = enrichTrip(trip, ctx.poiCache);
      const warnings = computeWarnings(enriched);
      // §6.3：超过半数点位无法回填时视为生成质量不合格
      if (
        warnings.totalPlaces >= 2 &&
        warnings.unenrichedCount / warnings.totalPlaces > 0.5
      ) {
        throw { code: 'TRIP_PARSE_FAILED', message: '行程数据回填失败过多，请重试' };
      }
      return { trip: enriched, weather: ctx.weather, personalized, warnings };
    } catch (e) {
      lastParseError = e;
      parseFailures++;
      console.warn(`[trip] 收尾第 ${parseFailures}/3 次解析/校验失败，重试中…`, e);
      if (parseFailures >= 3) break;
      // 把这轮回复也记进对话，并追加纠正指令，让它重吐一次。
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: '上面的输出不是合法 JSON，请只输出符合要求的 JSON 对象，不要任何多余文字或代码块包裹。',
      });
    }
  }

  console.error('[trip] 收尾 3 次均解析失败:', lastParseError);
  throw { code: 'TRIP_PARSE_FAILED', message: '行程生成失败，请重试' };
}
