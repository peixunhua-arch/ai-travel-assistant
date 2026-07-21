// 豆包（火山方舟）聊天：OpenAI 兼容协议，仅用于闲聊 / 流式 / 可选图片。
import OpenAI from 'openai';
import type { ImageInput } from './tripCommon.js';

const SYSTEM_PROMPT = [
  '你是「途灵」的资深旅游规划顾问，中文回答，语气沉稳、热情但不油腻。',
  '人设：像一位帮朋友排过上百趟旅行的资深规划师，懂玩，更懂怎么少踩坑。',
  '',
  '你擅长：目的地取舍、行程节奏、避坑、预算拆分、季节建议、同行人适配。',
  '',
  '回答要求：',
  '- 先给结论，再给 2～4 条可执行建议',
  '- 信息不确定时明确说「建议以官方/现场为准」（签证、政策、开放时间、安全）',
  '- 用户需求模糊时，最多追问 1～2 个关键问题，不要连珠炮',
  '- 不编造具体店名、价格、开放时间；需要精确 POI 时引导用户去「生成行程」',
  '- 简洁：默认控制在 200 字内，复杂方案可分点，但仍要短',
].join('\n');

function getClient(): OpenAI {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 DOUBAO_API_KEY：请在 apps/server/.env 配置豆包（火山方舟）密钥');
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  });
}

function modelId(): string {
  // 火山方舟一般为接入点 ID（ep-xxxx），也可是已开通的模型名
  return process.env.DOUBAO_MODEL || 'ep-xxxxxxxx';
}

function buildUserContent(
  userMessage: string,
  image?: ImageInput,
): string | OpenAI.Chat.ChatCompletionContentPart[] {
  if (!image) return userMessage;
  return [
    {
      type: 'image_url',
      image_url: {
        url: `data:${image.mediaType};base64,${image.base64}`,
      },
    },
    { type: 'text', text: userMessage },
  ];
}

/** 普通对话 */
export async function ask(userMessage: string, image?: ImageInput): Promise<string> {
  const client = getClient();
  const res = await client.chat.completions.create({
    model: modelId(),
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserContent(userMessage, image) },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('豆包未返回文本');
  return text;
}

/** SSE 流式对话 */
export async function askStream(
  userMessage: string,
  onDelta: (text: string) => void,
  image?: ImageInput,
): Promise<string> {
  const client = getClient();
  const stream = await client.chat.completions.create({
    model: modelId(),
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserContent(userMessage, image) },
    ],
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  if (!full) throw new Error('豆包流式未返回文本');
  return full;
}
