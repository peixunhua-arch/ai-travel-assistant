// 阶段 3.5：本地 SQLite 数据库（行程 + 评价落库）。
//
// 为什么用 SQLite？——练手项目零注册、无境外访问风险、离线可用。
// 为什么不装 better-sqlite3？——Node 24 自带 node:sqlite（DatabaseSync），零依赖、零原生编译，
//   避开「装 better-sqlite3 需 Visual Studio 构建工具」的 Windows/新手大坑。
//
// 这个文件被 import 时就会「打开库 + 建表」（副作用初始化）。index.ts 最上面 import 它即可。
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// 库文件路径：基于本文件位置推绝对路径 → apps/server/data/app.db。
// 为什么不用相对 cwd？——`pnpm dev`（tsx，cwd=apps/server）和 `node dist/index.js`（cwd 可能不同）
// 的工作目录不一样；用 import.meta.url 推绝对路径最稳，两种跑法都指向同一个库。
const here = dirname(fileURLToPath(import.meta.url)); // .../apps/server/src（dev）或 .../dist（build）
const dataDir = join(here, '..', 'data'); // 统一落到 apps/server/data
mkdirSync(dataDir, { recursive: true }); // 目录不存在就建（已存在不报错）
const dbPath = join(dataDir, 'app.db');

export const db = new DatabaseSync(dbPath);

// ⚠️ SQLite 默认「不开外键」！不开则 REFERENCES / ON DELETE CASCADE 形同虚设。
// 每个连接都要开一次。
db.exec('PRAGMA foreign_keys = ON');

// 建表 + 索引（IF NOT EXISTS：重启不会重复建，安全）。
// SQLite 方言注意：无 boolean（用 INTEGER）、无原生数组（tags 存 JSON 字符串）、
//   无 uuid 类型（id 用 randomUUID() 生成的字符串存 TEXT）、时间存 ISO 字符串。
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    device_id  TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination     TEXT NOT NULL,
    days_count      INTEGER NOT NULL,
    budget_estimate INTEGER,
    content         TEXT NOT NULL,          -- 完整行程 JSON（days 等）字符串
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    poi_id     TEXT,                          -- NULL = 整程总评；有值 = 对某 POI
    sentiment  INTEGER NOT NULL CHECK (sentiment IN (1, -1)),
    tags       TEXT NOT NULL DEFAULT '[]',    -- JSON 数组字符串
    comment    TEXT,
    created_at TEXT NOT NULL
  );

  -- ⚠️ 坑 #19：poi_id 为 NULL 时普通 UNIQUE 拦不住重复（NULL≠NULL）。
  -- 所以「单点」和「整程」分两个部分唯一索引，各自去重：
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_poi
    ON reviews(user_id, trip_id, poi_id) WHERE poi_id IS NOT NULL;  -- 每个点一条
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_trip
    ON reviews(user_id, trip_id)         WHERE poi_id IS NULL;      -- 每个行程一条总评

  CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_feedbacks (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    sentiment  INTEGER NOT NULL CHECK (sentiment IN (1, -1)),
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_chat_feedback
    ON chat_feedbacks(user_id, message_id);

  CREATE TABLE IF NOT EXISTS community_posts (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_type     TEXT NOT NULL CHECK (post_type IN ('trip', 'photo', 'review')),
    trip_id       TEXT REFERENCES trips(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    cover_photo   TEXT,
    trip_snapshot TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_community_posts_created
    ON community_posts(created_at DESC);

  CREATE TABLE IF NOT EXISTS post_likes (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS post_favorites (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS post_comments (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_post_comments_post
    ON post_comments(post_id, created_at ASC);
`);

// 迁移：老库补 updated_at 列
try {
  db.exec(`ALTER TABLE trips ADD COLUMN updated_at TEXT`);
} catch {
  // 列已存在
}
db.exec(`UPDATE trips SET updated_at = created_at WHERE updated_at IS NULL`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT`);
} catch {
  // 列已存在
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
} catch {
  // 列已存在
}

console.log(`✅ SQLite 已就绪: ${dbPath}`);
