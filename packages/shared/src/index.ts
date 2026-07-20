// 前后端共享类型 —— 只定义一份，避免字段漂移
// 认证、对话（阶段 1）+ 行程 Trip（阶段 2）。

// ---------- 认证 ----------
export interface AuthDeviceRequest {
  deviceId: string;
}

export interface AuthDeviceResponse {
  token: string;
  userId: string;
  expiresIn: number; // 秒
}

/** GET /api/auth/profile — 用户昵称与头像 */
export interface UserProfile {
  displayName: string;
  /** emoji:🧳 或 data:image/jpeg;base64,... */
  avatar: string;
}

export interface UpdateUserProfileInput {
  displayName?: string;
  avatar?: string;
}

// ---------- 对话 ----------
export interface ChatRequest {
  message: string;
  /** §16.1 拍照提问：JPEG/PNG base64（不含 data: 前缀） */
  imageBase64?: string;
  imageMediaType?: 'image/jpeg' | 'image/png';
}

export interface ChatResponse {
  reply: string;
}

// ---------- 统一错误格式 ----------
export interface ApiError {
  error: string;
  code: string;
}

// ---------- 行程 ----------
// 行程里的「一个安排」：几点、叫什么、什么类型、一句话说明。
// type 只有四种，前端据此显示对应 emoji（景点/餐饮/住宿/交通）。
// 下面 poiId 到 links 这一组是「阶段 3 才回填」的字段（坐标、评分、地址、跳转链接）：
// 阶段 2 的 Claude 不产出它们，所以全设成 optional（可有可无），这样阶段 3 加进来时
// 老数据不用改、类型也不会报错——这叫「前向兼容」。
export interface TripItem {
  time: string; // "09:30"（HH:MM 24 小时制）
  name: string;
  type: 'sight' | 'food' | 'hotel' | 'transport';
  description: string;
  // ↓ 阶段 3 回填，阶段 2 不产出
  poiId?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  address?: string;
  photoUrl?: string; // 高德 POI 首图（后端回填；老行程/无图为 undefined）
  opentime?: string; // 营业时间（高德回填，有才显示角标）
  // links 整块由后端 buildLinks() 拼好回填（Claude 不产出）：导航 + 小红书 + 大众点评。
  // 每个都给一对：scheme（唤起 App）+ 网页 url（App 没装时兜底）。
  links?: {
    dianpingUrl: string;
    xhsUrl: string;
    mapUrl: string;
    xhsScheme: string;
    dianpingScheme: string;
  };
}

// 「一天」的安排：第几天、当天主题、当天的若干条 item。
export interface TripDay {
  day: number; // 第几天，从 1 开始
  theme: string; // 当天主题，如「老城区人文一日」
  items: TripItem[];
}

// 一份完整行程（Claude 生成的核心结构）。
export interface Trip {
  destination: string;
  budgetEstimate: number; // 预算估算（整数，元）
  days: TripDay[];
}

// 前端发给后端的「生成行程」请求。
export interface TripGenerateRequest {
  destination: string;
  days: number; // 1-14
  budget: number; // 前端把「不限」映射成 0
  preferences: string[]; // 偏好标签，如 ['美食','打卡']
  prompt?: string; // 补充说明，可选
  /** §4.6 扩展：出行月份，如「7月」「国庆」 */
  travelMonth?: string;
  /** §4.6 扩展：同行人 */
  companions?: 'solo' | 'couple' | 'family' | 'elder' | 'friends';
  /** §4.6 扩展：行程节奏 */
  pace?: 'relaxed' | 'moderate' | 'packed';
  /** §4.6 扩展：出发城市（大交通/首日安排） */
  departureCity?: string;
  /** §8.2 多轮规划：基于已保存行程重新生成时带上服务端 id */
  previousTripId?: string;
}

/** 行程生成时的数据质量警告（§6.3 透明提示） */
export interface TripWarnings {
  /** 未能从高德回填坐标的非交通点位数 */
  unenrichedCount: number;
  /** 非交通点位总数 */
  totalPlaces: number;
  /** 安排过少（≤1 个非交通点）的天数 */
  sparseDays: number[];
}

// 「未来一天」的天气（阶段 3：和风天气 3 天预报，后端 get_weather 工具产出）。
// 字段名对齐和风返回：fxDate/tempMax/tempMin/textDay/iconDay。
export interface WeatherDay {
  date: string; // "2026-07-10"（和风 fxDate）
  tempMax: string; // 最高温，如 "34"
  tempMin: string; // 最低温，如 "24"
  textDay: string; // 白天天气文字，如「多云」
  iconDay?: string; // 和风图标码，可选
}

// 后端返回给前端的「生成结果」。
// daysCount 是天数（= days.length），单独给出来省得前端每次算。
// weather 是可选的未来 3 天预报（阶段 3 才有；只在预览页展示、不随 SavedTrip 持久化——
// 天气是预报，存久了会过期误导）。
export interface TripGenerateResponse {
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  days: TripDay[];
  weather?: WeatherDay[];
  /** 本次生成是否注入了该用户的历史偏好（供前端 Toast 提示） */
  personalized?: boolean;
  /** 数据回填质量警告（有未命中 POI 或某天过空时返回） */
  warnings?: TripWarnings;
  /** §6.3 生成失败或回填失败的天数（部分成功时前端展示重试入口） */
  failedDays?: number[];
}

// 本地保存用：在生成结果基础上，加「本地 id」和「保存时间」。
// 存进手机 AsyncStorage 的就是这个结构。
// 阶段 3.5：保存时顺带把行程上传到后端（评价要挂在服务端行程上）。上传成功拿到的
// 服务端 id 存进 serverTripId；老行程/上传失败时为 undefined —— 详情页据此判断「能否评价」。
/** 生成结果可解释信息（本地保存，便于详情页回显） */
export interface TripInsights {
  personalized?: boolean;
  warnings?: TripWarnings;
  /** 用户在表单勾选的偏好 */
  preferenceLabels?: string[];
  /** 生成时是否用了天气数据 */
  usedWeather?: boolean;
  /** 用户填写的预算（0=不限），用于对照预估 */
  userBudget?: number;
  /** 出行同行人（列表标签展示） */
  companions?: TripGenerateRequest['companions'];
  /** 行程节奏 */
  pace?: TripGenerateRequest['pace'];
}

export interface SavedTrip {
  id: string; // 本地 id（trip-时间戳-随机串），列表/详情页导航用
  createdAt: string; // ISO 时间字符串
  /** 最后编辑或同步时间（§5.3 列表展示） */
  updatedAt?: string;
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  days: TripDay[];
  serverTripId?: string; // 阶段 3.5：上传成功回填；评价接口用它
  /** §16.4 出行月份（保存时从表单带入，用于出行前提醒） */
  travelMonth?: string;
  /** 本次生成依据说明（可选，老数据无此字段） */
  insights?: TripInsights;
}

// ---------- 评价闭环（阶段 3.5） ----------
// sentiment：1=赞 👍，-1=踩 👎（用数字不用布尔，方便后端 SUM/AVG 聚合口碑）。
// poiId 省略/为 null = 对整个行程的总评；有值 = 对某个 POI（高德 id，对应 TripItem.poiId）。

// 上传行程的响应：拿到服务端行程 id。
export interface UploadTripResponse {
  serverTripId: string;
}

// 前端提交一条评价（POST /api/reviews 的 body）。
export interface ReviewInput {
  tripId: string; // 服务端行程 id（= SavedTrip.serverTripId）
  poiId?: string | null; // 省略/null = 整程总评
  sentiment: 1 | -1;
  tags?: string[]; // 标签，如 ['性价比高']
  comment?: string; // 可选短评（≤50 字）
}

// 一条已存在的评价的「回显状态」（用于详情页高亮已评项）。
export interface ReviewState {
  sentiment: 1 | -1;
  tags: string[];
  comment?: string;
}

// GET /api/reviews?tripId= 的响应：整程总评 + 各 POI 评价。
export interface TripReviews {
  tripReview: ReviewState | null; // 整程总评（poi_id 为 NULL 那条），没评过为 null
  poiReviews: Record<string, ReviewState>; // key = poiId
}

// GET /api/reviews/preferences —— 个人闭环可视化（「我的」页偏好卡片）。
export interface UserPreferences {
  liked: string[]; // 历史赞过的标签汇总
  disliked: string[]; // 历史踩过的标签汇总
  reviewCount: number; // 参与统计的评价条数
}

// GET /api/pois/reputation?ids= —— 某 POI 的社区口碑（冷启动 reviewCount=0 时不展示）。
export interface PoiReputation {
  poiId: string;
  reviewCount: number;
  likeRatio: number; // 0~1
  topTags: string[];
}

/** GET /api/distance — 两点通勤（高德距离 API） */
export interface DistanceResult {
  distanceM: number;
  durationS: number;
  mode: 'walk' | 'drive';
  label: string; // 如「步行约 800m · 10 分钟」
}

/** POST /api/chat/feedback — 聊天消息级反馈 */
export interface ChatFeedbackInput {
  messageId: string;
  sentiment: 1 | -1;
}

/** GET /api/trips 列表项 */
export interface CloudTripSummary {
  serverTripId: string;
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/trips/:id 详情 */
export interface CloudTripDetail extends TripGenerateResponse {
  serverTripId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- 社区（帖子 Feed） ----------
export type CommunityPostType = 'trip' | 'photo' | 'review';

export interface CommunityTripSnapshot {
  destination: string;
  daysCount: number;
  budgetEstimate: number;
  highlightItems?: Array<{ name: string; type: TripItem['type']; photoUrl?: string }>;
}

export interface CreateCommunityPostInput {
  type: CommunityPostType;
  title: string;
  body: string;
  tripId?: string;
  coverPhoto?: string;
  tripSnapshot?: CommunityTripSnapshot;
}

export interface CommunityPostSummary {
  id: string;
  authorId: string;
  authorLabel: string;
  /** emoji:… 或图片 data URI */
  authorAvatar?: string;
  type: CommunityPostType;
  title: string;
  excerpt: string;
  coverPhoto?: string;
  destination?: string;
  daysCount?: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  authorId: string;
  authorLabel: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface CommunityPostDetail extends CommunityPostSummary {
  body: string;
  tripSnapshot?: CommunityTripSnapshot;
  comments: CommunityComment[];
}

export interface CreateCommunityCommentInput {
  text: string;
}

export interface TogglePostActionResponse {
  active: boolean;
  likeCount?: number;
  favoriteCount?: number;
}
