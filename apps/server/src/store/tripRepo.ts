// 行程数据访问（trips 表）。
// 从 store.ts 拆出——纯搬代码，逻辑不变。
import { randomUUID } from 'node:crypto';
import type { TripGenerateResponse } from '@travel/shared';
import { db } from '../db.js';

/**
 * 存一份行程，返回新生成的服务端行程 id。
 * content 存完整行程 JSON（days 等），评价用不到细节但保留完整以备后续（如社区口碑要按 POI 反查）。
 */
export function insertTrip(userId: string, trip: TripGenerateResponse): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO trips (id, user_id, destination, days_count, budget_estimate, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    trip.destination,
    trip.daysCount,
    trip.budgetEstimate,
    JSON.stringify(trip),
    now,
    now,
  );
  return id;
}

export function updateTrip(
  tripId: string,
  userId: string,
  trip: TripGenerateResponse,
): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE trips SET destination = ?, days_count = ?, budget_estimate = ?, content = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      trip.destination,
      trip.daysCount,
      trip.budgetEstimate,
      JSON.stringify(trip),
      now,
      tripId,
      userId,
    );
  return result.changes > 0;
}

export function getTripById(
  tripId: string,
  userId: string,
): (TripGenerateResponse & { serverTripId: string; createdAt: string; updatedAt: string }) | null {
  const row = db
    .prepare(
      `SELECT id, destination, days_count AS daysCount, budget_estimate AS budgetEstimate,
              content, created_at AS createdAt, updated_at AS updatedAt
       FROM trips WHERE id = ? AND user_id = ?`,
    )
    .get(tripId, userId) as
    | {
        id: string;
        destination: string;
        daysCount: number;
        budgetEstimate: number;
        content: string;
        createdAt: string;
        updatedAt: string;
      }
    | undefined;
  if (!row) return null;
  const content = JSON.parse(row.content) as TripGenerateResponse;
  return {
    ...content,
    serverTripId: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

export function listTripsForUser(userId: string): Array<{
  serverTripId: string;
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  createdAt: string;
  updatedAt: string;
}> {
  const rows = db
    .prepare(
      `SELECT id AS serverTripId, destination, days_count AS daysCount,
              budget_estimate AS budgetEstimate, created_at AS createdAt,
              updated_at AS updatedAt
       FROM trips WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId) as Array<{
    serverTripId: string;
    destination: string;
    daysCount: number;
    budgetEstimate: number;
    createdAt: string;
    updatedAt: string;
  }>;
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt ?? r.createdAt }));
}

/**
 * 查某行程属于哪个用户。用于评价接口的「归属校验」（坑 #22）。
 * 返回 user_id；行程不存在返回 null。
 */
export function getTripOwner(tripId: string): string | null {
  const row = db.prepare('SELECT user_id AS userId FROM trips WHERE id = ?').get(tripId) as
    | { userId: string }
    | undefined;
  return row?.userId ?? null;
}
