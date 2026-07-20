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

// 启动前检查关键环境变量，早失败早发现
// 走网关用 CLAUDE_AUTH_TOKEN（Bearer），直连官方用 CLAUDE_API_KEY（sk-ant-），二者需其一
if (!process.env.CLAUDE_AUTH_TOKEN && !process.env.CLAUDE_API_KEY) {
  console.error('❌ 缺少 Claude 凭证：请复制 .env.example 为 .env，并填入 CLAUDE_AUTH_TOKEN（课程网关）或 CLAUDE_API_KEY（官方直连）');
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
});
