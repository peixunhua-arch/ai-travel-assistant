// 用户数据访问（users 表）。
// 从 store.ts 拆出——纯搬代码，逻辑不变。
import { randomUUID } from 'node:crypto';
import type { UserProfile, UpdateUserProfileInput } from '@travel/shared';
import { db } from '../db.js';

export interface User {
  id: string;
  deviceId: string;
  createdAt: string;
}

const DEFAULT_DISPLAY_NAME = '途灵旅行者';
const DEFAULT_AVATAR = 'emoji:🧳';

/**
 * 按 deviceId upsert 用户：有则返回，无则新建。签名与阶段 1 相同。
 * auth 路由调它拿到 user 再签 JWT。
 */
export function upsertUserByDeviceId(deviceId: string): User {
  const row = db
    .prepare('SELECT id, device_id AS deviceId, created_at AS createdAt FROM users WHERE device_id = ?')
    .get(deviceId) as User | undefined;
  if (row) return row;

  const user: User = {
    id: randomUUID(),
    deviceId,
    createdAt: new Date().toISOString(),
  };
  db.prepare('INSERT INTO users (id, device_id, created_at) VALUES (?, ?, ?)').run(
    user.id,
    user.deviceId,
    user.createdAt,
  );
  return user;
}

export function getUserProfile(userId: string): UserProfile | null {
  const row = db
    .prepare('SELECT display_name AS displayName, avatar FROM users WHERE id = ?')
    .get(userId) as { displayName: string | null; avatar: string | null } | undefined;
  if (!row) return null;
  return {
    displayName: row.displayName?.trim() || DEFAULT_DISPLAY_NAME,
    avatar: row.avatar?.trim() || DEFAULT_AVATAR,
  };
}

export function updateUserProfile(userId: string, input: UpdateUserProfileInput): UserProfile | null {
  const current = getUserProfile(userId);
  if (!current) return null;

  const displayName = input.displayName?.trim() || current.displayName;
  const avatar = input.avatar?.trim() || current.avatar;

  db.prepare('UPDATE users SET display_name = ?, avatar = ? WHERE id = ?').run(
    displayName.slice(0, 20),
    avatar.slice(0, 120_000),
    userId,
  );

  return { displayName: displayName.slice(0, 20), avatar };
}

// ---- 社区帖子展示用的作者信息（读 users 表，communityRepo 调用） ----

export function authorLabel(userId: string): string {
  const row = db
    .prepare('SELECT display_name AS displayName FROM users WHERE id = ?')
    .get(userId) as { displayName: string | null } | undefined;
  if (row?.displayName?.trim()) return row.displayName.trim();
  return `旅行者${userId.replace(/-/g, '').slice(0, 6)}`;
}

export function authorAvatar(userId: string): string | undefined {
  const row = db
    .prepare('SELECT avatar FROM users WHERE id = ?')
    .get(userId) as { avatar: string | null } | undefined;
  return row?.avatar?.trim() || undefined;
}
