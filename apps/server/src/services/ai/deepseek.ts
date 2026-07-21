// DeepSeek 行程 Agent：OpenAI 兼容 Tool Calling + 高德/和风真实数据回填。
import OpenAI from 'openai';
import type { TripGenerateRequest } from '@travel/shared';
import {
  TRIP_SYSTEM_PROMPT,
  FINAL_INSTRUCTION,
  RETRY_JSON_INSTRUCTION,
  OPENAI_TRIP_TOOLS,
  extractJson,
  tripSchema,
  executeTool,
  enrichTrip,
  computeWarnings,
  buildTripUserMessage,
  withUserPreferences,
  type ToolCtx,
  type TripGenerateResult,
} from './tripCommon.js';

function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 DEEPSEEK_API_KEY：请在 apps/server/.env 配置 DeepSeek 密钥');
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
}

function modelId(): string {
  // 默认 deepseek-v4；若账号暂未开通，可改为 deepseek-chat / deepseek-reasoner
  return process.env.DEEPSEEK_MODEL || 'deepseek-v4';
}

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

function parseToolArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/**
 * DeepSeek 行程生成（工具轮 + JSON 收尾 + Zod + enrich）。
 * 失败抛普通对象 { code, message }，与历史 Claude 路由约定一致。
 */
export async function generateTrip(
  req: TripGenerateRequest,
  userId?: string,
): Promise<TripGenerateResult> {
  const client = getClient();
  const model = modelId();
  const userMessage = buildTripUserMessage(req);
  const { content: initialContent, personalized } = withUserPreferences(userMessage, userId);

  const messages: ChatMessage[] = [
    { role: 'system', content: TRIP_SYSTEM_PROMPT },
    { role: 'user', content: initialContent },
  ];
  const ctx: ToolCtx = { poiCache: new Map(), weather: null };

  // ---------- Phase A：工具轮 ----------
  for (let round = 0; round < 10; round++) {
    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages,
        tools: OPENAI_TRIP_TOOLS,
        tool_choice: 'auto',
      });
    } catch (e) {
      console.error('[trip] DeepSeek 调用失败(Phase A):', e);
      throw { code: 'CLAUDE_ERROR', message: (e as Error)?.message };
    }

    const msg = res.choices[0]?.message;
    if (!msg) {
      throw { code: 'CLAUDE_ERROR', message: 'DeepSeek 未返回 message' };
    }

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        try {
          const result = await executeTool(tc.function.name, parseToolArgs(tc.function.arguments), ctx);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        } catch (e) {
          console.warn(`[trip] 工具 ${tc.function.name} 执行失败:`, e);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: `工具执行失败：${(e as Error)?.message ?? '未知错误'}`,
          });
        }
      }
      continue;
    }

    // 不再调工具 → 进入收尾
    break;
  }

  messages.push({ role: 'user', content: FINAL_INSTRUCTION });

  // ---------- Phase B：收尾 JSON ----------
  let parseFailures = 0;
  let lastParseError: unknown = null;
  for (let i = 0; i < 6; i++) {
    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await client.chat.completions.create({
        model,
        max_tokens: 8192,
        messages,
        tools: OPENAI_TRIP_TOOLS,
        tool_choice: 'auto',
      });
    } catch (e) {
      console.error('[trip] DeepSeek 调用失败(Phase B):', e);
      throw { code: 'CLAUDE_ERROR', message: (e as Error)?.message };
    }

    const msg = res.choices[0]?.message;
    if (!msg) {
      parseFailures++;
      lastParseError = new Error('empty message');
      if (parseFailures >= 3) break;
      continue;
    }

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        try {
          const result = await executeTool(tc.function.name, parseToolArgs(tc.function.arguments), ctx);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        } catch (e) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: `工具执行失败：${(e as Error)?.message ?? '未知错误'}`,
          });
        }
      }
      continue;
    }

    const text = (msg.content ?? '').trim();
    try {
      const json = JSON.parse(extractJson(text));
      const trip = tripSchema.parse(json);
      const enriched = enrichTrip(trip, ctx.poiCache);
      const warnings = computeWarnings(enriched);
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
      console.warn(`[trip] DeepSeek 收尾第 ${parseFailures}/3 次解析失败，重试中…`, e);
      if (parseFailures >= 3) break;
      messages.push({ role: 'assistant', content: text || '(empty)' });
      messages.push({ role: 'user', content: RETRY_JSON_INSTRUCTION });
    }
  }

  console.error('[trip] DeepSeek 收尾 3 次均解析失败:', lastParseError);
  throw { code: 'TRIP_PARSE_FAILED', message: '行程生成失败，请重试' };
}
