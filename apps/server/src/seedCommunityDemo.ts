// 社区演示数据：效果图同款帖子（幂等，缺哪条补哪条）。
import { db } from './db.js';

type DemoAuthor = {
  id: string;
  deviceId: string;
  name: string;
  avatar: string;
};

type DemoPost = {
  id: string;
  authorId: string;
  type: 'trip' | 'photo' | 'review';
  title: string;
  body: string;
  coverPhoto: string;
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  likeFrom: string[];
  createdOffsetMin: number;
};

const AUTHORS: DemoAuthor[] = [
  { id: 'demo-user-aze', deviceId: 'demo-device-aze', name: '川味控阿泽', avatar: 'emoji:🌶️' },
  { id: 'demo-user-yun', deviceId: 'demo-device-yun', name: '云边旅人', avatar: 'emoji:☁️' },
  { id: 'demo-user-yu', deviceId: 'demo-device-yu', name: '小鱼爱旅行', avatar: 'emoji:🐟' },
  { id: 'demo-user-gu', deviceId: 'demo-device-gu', name: '古都漫步', avatar: 'emoji:🏯' },
  { id: 'demo-user-neon', deviceId: 'demo-device-neon', name: '霓虹旅客', avatar: 'emoji:🌃' },
  { id: 'demo-user-hang', deviceId: 'demo-device-hang', name: '江南骑行者', avatar: 'emoji:🚲' },
];

const POSTS: DemoPost[] = [
  {
    id: 'demo-post-chengdu-food',
    authorId: 'demo-user-aze',
    type: 'trip',
    title: '成都三天美食路线',
    body: '宽窄巷子 → 锦里 → 火锅宵夜，途灵帮我排好节奏，三天吃爽还不赶场。收藏这份清单，直接照着走就行。',
    coverPhoto:
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
    destination: '成都',
    daysCount: 3,
    budgetEstimate: 2800,
    likeFrom: ['demo-user-yun', 'demo-user-yu', 'demo-user-gu', 'demo-user-neon'],
    createdOffsetMin: 40,
  },
  {
    id: 'demo-post-dali-slow',
    authorId: 'demo-user-yun',
    type: 'trip',
    title: '大理慢旅行攻略',
    body: '不想赶特种兵！两天一夜泡古城、骑行海西，晚上苍山看日落。适合带爸妈和朋友结伴的轻松节奏。',
    coverPhoto:
      'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=800&q=80',
    destination: '大理',
    daysCount: 2,
    budgetEstimate: 1800,
    likeFrom: ['demo-user-aze', 'demo-user-yu', 'demo-user-hang'],
    createdOffsetMin: 90,
  },
  {
    id: 'demo-post-hangzhou-bike',
    authorId: 'demo-user-yu',
    type: 'photo',
    title: '杭州西湖骑行日记',
    body: '绕湖半圈吹风太舒服了，白堤拍了一堆片。周末短途推荐，傍晚苏堤颜色绝了。',
    coverPhoto:
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
    destination: '杭州',
    daysCount: 1,
    budgetEstimate: 600,
    likeFrom: [
      'demo-user-aze',
      'demo-user-yun',
      'demo-user-gu',
      'demo-user-neon',
      'demo-user-hang',
    ],
    createdOffsetMin: 120,
  },
  {
    id: 'demo-post-xian-heritage',
    authorId: 'demo-user-gu',
    type: 'trip',
    title: '西安古迹半日游',
    body: '兵马俑半天 + 回民街晚饭刚刚好。途灵生成时把通勤写清楚了，少走冤枉路。',
    coverPhoto:
      'https://images.unsplash.com/photo-1599571234909-29eddf3e8944?auto=format&fit=crop&w=800&q=80',
    destination: '西安',
    daysCount: 1,
    budgetEstimate: 900,
    likeFrom: ['demo-user-aze', 'demo-user-yun'],
    createdOffsetMin: 180,
  },
  {
    id: 'demo-post-chongqing-night',
    authorId: 'demo-user-neon',
    type: 'photo',
    title: '重庆夜景打卡',
    body: '洪崖洞对面拍夜景，再去吃一顿小面。热门点位人多，建议晚饭后错峰。',
    coverPhoto:
      'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=800&q=80',
    destination: '重庆',
    daysCount: 2,
    budgetEstimate: 1500,
    likeFrom: ['demo-user-yu', 'demo-user-hang', 'demo-user-aze', 'demo-user-gu'],
    createdOffsetMin: 240,
  },
  {
    id: 'demo-post-suzhou-garden',
    authorId: 'demo-user-hang',
    type: 'trip',
    title: '苏州园林周末短途',
    body: '拙政园 + 平江路一日走透透。上海出发很方便，途灵短途规划两分钟出炉。',
    coverPhoto:
      'https://images.unsplash.com/photo-1555929441-5a6a0fca87d9?auto=format&fit=crop&w=800&q=80',
    destination: '苏州',
    daysCount: 2,
    budgetEstimate: 1200,
    likeFrom: ['demo-user-yun', 'demo-user-yu', 'demo-user-neon'],
    createdOffsetMin: 300,
  },
];

function ensureAuthor(a: DemoAuthor): void {
  const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(a.id);
  if (!exists) {
    db.prepare(
      'INSERT INTO users (id, device_id, created_at, display_name, avatar) VALUES (?, ?, ?, ?, ?)',
    ).run(a.id, a.deviceId, new Date().toISOString(), a.name, a.avatar);
  } else {
    db.prepare('UPDATE users SET display_name = ?, avatar = ? WHERE id = ?').run(
      a.name,
      a.avatar,
      a.id,
    );
  }
}

/** 启动时调用：写入效果图同款社区演示帖（幂等）。 */
export function seedCommunityDemo(): void {
  try {
    for (const a of AUTHORS) ensureAuthor(a);

    const insertPost = db.prepare(
      `INSERT INTO community_posts
        (id, user_id, post_type, trip_id, title, body, cover_photo, trip_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertLike = db.prepare(
      'INSERT OR IGNORE INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, ?)',
    );

    const now = Date.now();
    let inserted = 0;
    for (const p of POSTS) {
      const exists = db.prepare('SELECT 1 FROM community_posts WHERE id = ?').get(p.id);
      const createdAt = new Date(now - p.createdOffsetMin * 60_000).toISOString();
      if (!exists) {
        const snapshot = JSON.stringify({
          destination: p.destination,
          daysCount: p.daysCount,
          budgetEstimate: p.budgetEstimate,
        });
        insertPost.run(
          p.id,
          p.authorId,
          p.type,
          null,
          p.title,
          p.body,
          p.coverPhoto,
          snapshot,
          createdAt,
        );
        inserted += 1;
      }
      for (const uid of p.likeFrom) {
        insertLike.run(uid, p.id, createdAt);
      }
    }

    if (inserted > 0) {
      console.log(`✅ 已种入社区演示帖 ${inserted} 条（效果图同款）`);
    } else {
      console.log('ℹ️  社区演示数据已齐全，跳过种入');
    }
  } catch (e) {
    console.error('⚠️  社区演示数据种入失败:', e);
  }
}
