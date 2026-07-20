// 对话反馈数据访问（chat_feedbacks 表）。
// 从 store.ts 拆出——纯搬代码，逻辑不变。
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export function upsertChatFeedback(
  userId: string,
  messageId: string,
  sentiment: 1 | -1,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO chat_feedbacks (id, user_id, message_id, sentiment, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, message_id) DO UPDATE SET
       sentiment = excluded.sentiment, created_at = excluded.created_at`,
  ).run(randomUUID(), userId, messageId, sentiment, now);
}
