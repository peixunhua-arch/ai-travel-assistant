// 后端入口：加载环境变量 → 配置中间件 → 挂路由 → 启动。
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './db.js'; // 阶段 3.5：import 即「打开 SQLite + 建表」（副作用初始化），放在路由之前
import { seedCommunityDemo } from './seedCommunityDemo.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { tripRouter } from './routes/trip.js';
import { tripsRouter } from './routes/trips.js';
import { reviewsRouter } from './routes/reviews.js';
import { poisRouter } from './routes/pois.js';
import { weatherRouter } from './routes/weather.js';
import { distanceRouter } from './routes/distance.js';
import { chatFeedbackRouter } from './routes/chatFeedback.js';
import { communityRouter } from './routes/community.js';

// 启动前检查 AI 凭证：聊天用豆包，行程用 DeepSeek
if (!process.env.DOUBAO_API_KEY) {
  console.error('❌ 缺少 DOUBAO_API_KEY：聊天走豆包（火山方舟），请在 apps/server/.env 配置');
  process.exit(1);
}
if (!process.env.DOUBAO_MODEL || process.env.DOUBAO_MODEL === 'ep-xxxxxxxx') {
  console.warn('⚠️  DOUBAO_MODEL 未配置真实接入点 ID（ep-xxxx），聊天可能失败');
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 缺少 DEEPSEEK_API_KEY：行程走 DeepSeek，请在 apps/server/.env 配置');
  process.exit(1);
}

const app = express();

app.use(cors()); // 开发阶段允许所有来源；生产环境再收紧到你的域名
app.use(express.json());

// 健康检查：浏览器/curl 打开能看到，确认服务活着
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/trip', tripRouter);
app.use('/api/trips', tripsRouter); // 阶段 3.5：行程上云（POST）
app.use('/api/reviews', reviewsRouter); // 阶段 3.5：评价（POST upsert / GET 回显 / GET preferences）
app.use('/api/pois', poisRouter); // 阶段 3.5：POI 社区口碑
app.use('/api/weather', weatherRouter);
app.use('/api/distance', distanceRouter);
app.use('/api/chat/feedback', chatFeedbackRouter);
app.use('/api/community', communityRouter);

seedCommunityDemo();

const PORT = Number(process.env.PORT ?? 3000);
// 监听 0.0.0.0，手机真机才能通过局域网 IP 访问（不能只听 localhost）
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 后端已启动: http://localhost:${PORT}`);
  console.log(`   健康检查:   http://localhost:${PORT}/health`);
  console.log(`   聊天模型:   豆包 (${process.env.DOUBAO_MODEL || '未配置'})`);
  console.log(`   行程模型:   DeepSeek (${process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'})`);
});
