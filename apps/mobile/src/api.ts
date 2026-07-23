// 和后端打交道的封装：管设备身份、登录拿 token、发消息。
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthDeviceResponse,
  ChatResponse,
  ChatRequest,
  ApiError,
  TripGenerateRequest,
  TripGenerateResponse,
  WeatherDay,
  ReviewInput,
  TripReviews,
  UploadTripResponse,
  UserPreferences,
  PoiReputation,
  DistanceResult,
  ChatFeedbackInput,
  CloudTripSummary,
  CloudTripDetail,
  SavedTrip,
  CommunityPostSummary,
  CommunityPostDetail,
  CreateCommunityPostInput,
  CreateCommunityCommentInput,
  CommunityComment,
  TogglePostActionResponse,
  UserProfile,
  UpdateUserProfileInput,
} from '@travel/shared';
import { getApiBaseUrl } from './apiBase';
import { mapApiError } from './lib/apiError';

// AsyncStorage 里存东西用的 key（相当于本地的两个小抽屉）
const DEVICE_ID_KEY = 'deviceId';
const TOKEN_KEY = 'token';

// 生成一个够长的随机设备号（后端要求 ≥8 位）。首次启动时生成一次，之后一直复用。
function generateDeviceId(): string {
  const rand = Math.random().toString(36).slice(2);
  return `dev-${Date.now()}-${rand}`;
}

// 取设备号：本地有就用本地的，没有就新生成并存下来。
async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * 连通性预检：启动时问一下后端「你还活着吗」。
 * 返回详细结果，便于「测试连接」展示真实失败原因。
 */
export async function checkHealthDetailed(): Promise<{ ok: boolean; error?: string; url: string }> {
  const url = `${getApiBaseUrl()}/health`;
  // 不使用 AbortController / XMLHttpRequest：RN 0.81 上二者都会踩 Event.NONE 只读坑
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, url, error: `HTTP ${res.status}` };
    }
    return { ok: true, url };
  } catch (fetchErr) {
    const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    const stack = fetchErr instanceof Error ? fetchErr.stack : '';
    return {
      ok: false,
      url,
      error: stack ? `${fetchMsg}\n${stack.split('\n').slice(0, 4).join('\n')}` : fetchMsg || '失败',
    };
  }
}

export async function checkHealth(): Promise<boolean> {
  const r = await checkHealthDetailed();
  return r.ok;
}

// 把后端返回的错误体解析成一句人话（后端约定是 { error, code }）。
async function readError(res: Response, context?: 'chat' | 'trip'): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    return mapApiError(res.status, body, context);
  } catch {
    return mapApiError(res.status, undefined, context);
  }
}

/** 把 RN 的「Network request failed」翻成可操作的排查提示 */
function wrapNetworkError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('Aborted')) {
    return new Error(
      `无法连接服务器 ${getApiBaseUrl()}\n\n请检查：\n` +
        '1. 手机能否打开该地址（浏览器访问 /health）\n' +
        '2. 若连了会议室/访客 WiFi，先关掉 WiFi 改用手机流量\n' +
        '3. 在「我的 → 服务器」确认地址为 http://47.99.246.14:3000 后点「测试连接」\n' +
        '4. 不要开仅代理局域网的 VPN',
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

// 用设备号登录，拿到 JWT 并存起来。
async function login(): Promise<string> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${getApiBaseUrl()}/api/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) throw new Error(await readError(res));

    const data = (await res.json()) as AuthDeviceResponse;
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    return data.token;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

// 拿一个可用的 token：本地有就直接用，没有就登录换一个。
async function getToken(): Promise<string> {
  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  return login();
}

/**
 * 发一条消息给 AI，返回它的回复。
 * 如果 token 过期（401），自动重新登录再试一次。
 */
export async function sendMessage(message: string): Promise<string> {
  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message } satisfies ChatRequest),
    });

  let token = await getToken();
  let res = await doRequest(token);

  // token 失效：清掉重登一次
  if (res.status === 401) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    token = await login();
    res = await doRequest(token);
  }

  if (!res.ok) throw new Error(await readError(res));

  const data = (await res.json()) as ChatResponse;
  return data.reply;
}

type SseChatPayload = {
  text?: string;
  done?: boolean;
  reply?: string;
  error?: string;
};

/** 从 SSE 文本行解析聊天增量（RN fetch 常无 ReadableStream，需走 text 降级） */
function consumeSseLines(
  chunk: string,
  onDelta: (chunk: string) => void,
  state: { full: string },
): void {
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const payload = JSON.parse(line.slice(6)) as SseChatPayload;
      if (payload.error) throw new Error(payload.error);
      if (payload.text) {
        state.full += payload.text;
        onDelta(payload.text);
      }
      if (payload.done && payload.reply) state.full = payload.reply;
    } catch (e) {
      if (e instanceof SyntaxError) continue;
      throw e;
    }
  }
}

/**
 * 流式发消息（SSE，UX §8.1）：onDelta 每收到一段文本就回调，返回完整回复。
 * 若流式不可用则自动降级为非流式。
 */
export async function sendMessageStream(
  message: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
  image?: Pick<ChatRequest, 'imageBase64' | 'imageMediaType'>,
): Promise<string> {
  const body: ChatRequest = { message, ...image };

  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/chat?stream=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });

  let token = await getToken();
  let res = await doRequest(token);

  if (res.status === 401) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    token = await login();
    res = await doRequest(token);
  }

  if (!res.ok) throw new Error(await readError(res));

  const contentType = res.headers.get('content-type') ?? '';
  const reader = res.body?.getReader();
  const state = { full: '' };

  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      consumeSseLines(lines.join('\n'), onDelta, state);
    }
    if (buffer) consumeSseLines(buffer, onDelta, state);
    return state.full;
  }

  // RN 真机 fetch 往往没有 body.getReader；SSE 响应不能用 res.json()（会以 "data:" 开头报 JSON 错）
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    consumeSseLines(text, onDelta, state);
    return state.full;
  }

  const data = (await res.json()) as ChatResponse;
  onDelta(data.reply);
  return data.reply;
}

/**
 * 生成行程。把用户填的表单需求发给后端，后端调 Claude 产出结构化行程。
 *
 * 两个「超时/取消」怎么处理（初学者重点看这里）：
 *   1) 内部 120 秒超时——阶段 3 变成 Agent 多轮（每轮都调 Claude，中间还夹着高德/和风的真实
 *      网络请求），比阶段 2 的「一问一答」慢不少，所以从 90s 放宽到 120s，给足余量；超了自动
 *      中止，避免用户界面无限转圈。用一个内部 AbortController + setTimeout 实现。
 *   2) 外部取消——调用方（预览页）可能想让用户「点取消」提前中止。做法不是去合并两个 signal
 *      （那很绕），而是：把外部 signal 的 abort「桥接」到内部 controller 上——外部一取消，
 *      就顺手把内部也 abort 掉。fetch 只认内部这一个 signal，简单可靠。
 *
 * 401 自动重登一次（照抄 sendMessage 的套路）。
 */
export async function generateTrip(
  params: TripGenerateRequest,
  signal?: AbortSignal,
): Promise<TripGenerateResponse> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), 120_000);

  // 桥接：外部一旦取消，就把内部 controller 也 abort。{ once:true } 触发一次即自动解绑。
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', () => timeoutController.abort(), { once: true });
  }

  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/trip/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
      signal: timeoutController.signal,
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);

    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }

    if (!res.ok) throw new Error(await readError(res, 'trip'));

    return (await res.json()) as TripGenerateResponse;
  } catch (e) {
    throw wrapNetworkError(e);
  } finally {
    clearTimeout(timer); // 成功/失败都要清掉定时器，别泄漏
  }
}

/**
 * 查某城市未来 3 天天气（详情页实时拉，因为存下来的预报会过期）。
 *
 * 和 generateTrip 不同——天气是「锦上添花」，绝不该因为它失败就打扰用户：
 *   任何情况（网络错、超时、未知城市、后端兜的空数组）都 return []，
 *   由详情页拿到空数组时「不显示天气条」即可。所以这里全程 try/catch 吞掉，不抛错。
 * 10 秒超时：天气非核心，别让它拖着详情页干等。
 */
export async function fetchWeather(city: string): Promise<WeatherDay[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/weather?city=${encodeURIComponent(city)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);

    // token 失效：清掉重登一次（照抄 sendMessage 的套路）。
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }

    if (!res.ok) return []; // 后端异常也当「没天气」，不打扰用户
    const data = (await res.json()) as { weather?: WeatherDay[] };
    return data.weather ?? [];
  } catch {
    return []; // 网络错/超时/取消：一律空，详情页据此不显示
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 阶段 3.5：把行程上传到服务端，返回服务端行程 id（评价要挂在它上面）。
 *
 * 「尽力而为」——和 fetchWeather 一样：任何失败都返回 null（不抛错），
 * 因为它是在 saveTrip 里「顺带」做的，绝不能因为上传失败就打断本地保存。
 * 无 serverTripId 的行程，详情页会显示「未同步，暂不能评价」。
 * 401 自动重登一次（照抄其它接口的套路）。
 */
export async function uploadTrip(trip: TripGenerateResponse): Promise<string | null> {
  // 10 秒超时：上传是保存流程里「顺带」做的，绝不能让它把「保存」按钮卡死。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(trip),
      signal: controller.signal,
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return null;
    const data = (await res.json()) as UploadTripResponse;
    return data.serverTripId ?? null;
  } catch {
    return null; // 网络错/超时/离线：本地保存照常成功，只是这份暂不能评价
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 阶段 3.5：提交一条评价（后端 upsert，重复提交覆盖）。
 * 成功返回 true，失败返回 false（详情页据此提示，不崩）。401 自动重登。
 */
export async function postReview(input: ReviewInput): Promise<boolean> {
  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 阶段 3.5：取某行程的评价（整程 + 各 POI），供详情页回显高亮。
 * 失败返回 null（详情页当「暂无回显」处理）。401 自动重登。
 */
export async function getTripReviews(serverTripId: string): Promise<TripReviews | null> {
  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/reviews?tripId=${encodeURIComponent(serverTripId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return null;
    return (await res.json()) as TripReviews;
  } catch {
    return null;
  }
}

/** 个人偏好汇总（「我的」页偏好卡片）。失败返回 null。 */
export async function fetchUserPreferences(): Promise<UserPreferences | null> {
  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/reviews/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return null;
    return (await res.json()) as UserPreferences;
  } catch {
    return null;
  }
}

/** 批量查 POI 社区口碑。失败返回空对象。 */
export async function fetchPoiReputations(
  poiIds: string[],
): Promise<Record<string, PoiReputation>> {
  if (poiIds.length === 0) return {};
  const ids = [...new Set(poiIds)].join(',');

  const doRequest = async (token: string): Promise<Response> =>
    fetch(`${getApiBaseUrl()}/api/pois/reputation?ids=${encodeURIComponent(ids)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return {};
    const data = (await res.json()) as { items?: PoiReputation[] };
    const map: Record<string, PoiReputation> = {};
    for (const item of data.items ?? []) {
      map[item.poiId] = item;
    }
    return map;
  } catch {
    return {};
  }
}

/** §5.5 高德通勤距离 */
export async function fetchCommuteDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<DistanceResult | null> {
  const q = `fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`;
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}/api/distance?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return null;
    return (await res.json()) as DistanceResult;
  } catch {
    return null;
  }
}

/** §5.4 编辑后同步云端 */
export async function updateCloudTrip(
  serverTripId: string,
  trip: TripGenerateResponse,
): Promise<boolean> {
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}/api/trips/${serverTripId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(trip),
    });
  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** §6.5 从云端拉取单条行程 */
export async function fetchCloudTrip(serverTripId: string): Promise<CloudTripDetail | null> {
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}/api/trips/${serverTripId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return null;
    return (await res.json()) as CloudTripDetail;
  } catch {
    return null;
  }
}

/** §6.5 云端行程列表 */
export async function fetchCloudTrips(): Promise<CloudTripSummary[]> {
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}/api/trips`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: CloudTripSummary[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

/** §16.2 聊天反馈上云 */
export async function postChatFeedback(input: ChatFeedbackInput): Promise<boolean> {
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}/api/chat/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  try {
    let token = await getToken();
    let res = await doRequest(token);
    if (res.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      token = await login();
      res = await doRequest(token);
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** 云端详情转本地 SavedTrip */
export function cloudToSavedTrip(cloud: CloudTripDetail, localId?: string): SavedTrip {
  return {
    id: localId ?? `trip-cloud-${cloud.serverTripId}`,
    createdAt: cloud.createdAt,
    updatedAt: cloud.updatedAt,
    destination: cloud.destination,
    daysCount: cloud.daysCount,
    budgetEstimate: cloud.budgetEstimate,
    days: cloud.days,
    serverTripId: cloud.serverTripId,
  };
}

// ---------- 社区 ----------

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const doRequest = async (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  let token = await getToken();
  let res = await doRequest(token);
  if (res.status === 401) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    token = await login();
    res = await doRequest(token);
  }
  return res;
}

export async function fetchCommunityPosts(opts?: {
  limit?: number;
  offset?: number;
}): Promise<CommunityPostSummary[]> {
  try {
    const limit = opts?.limit ?? 30;
    const offset = opts?.offset ?? 0;
    const res = await authFetch(
      `/api/community/posts?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
    );
    if (!res.ok) throw new Error('社区列表加载失败');
    const data = (await res.json()) as { items?: CommunityPostSummary[] };
    return data.items ?? [];
  } catch (e) {
    if (e instanceof Error && e.message.includes('社区')) throw e;
    throw new Error('社区列表加载失败，请检查网络');
  }
}

export async function fetchFavoritePosts(): Promise<CommunityPostSummary[]> {
  try {
    const res = await authFetch('/api/community/posts/favorites');
    if (!res.ok) throw new Error('收藏列表加载失败');
    const data = (await res.json()) as { items?: CommunityPostSummary[] };
    return data.items ?? [];
  } catch (e) {
    if (e instanceof Error && e.message.includes('收藏')) throw e;
    throw new Error('收藏列表加载失败，请检查网络');
  }
}

export async function fetchCommunityPost(id: string): Promise<CommunityPostDetail | null> {
  try {
    const res = await authFetch(`/api/community/posts/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as CommunityPostDetail;
  } catch {
    return null;
  }
}

export async function createCommunityPost(
  input: CreateCommunityPostInput,
): Promise<string | null> {
  try {
    const res = await authFetch('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function togglePostLike(postId: string): Promise<TogglePostActionResponse | null> {
  try {
    const res = await authFetch(`/api/community/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return (await res.json()) as TogglePostActionResponse;
  } catch {
    return null;
  }
}

export async function togglePostFavorite(
  postId: string,
): Promise<TogglePostActionResponse | null> {
  try {
    const res = await authFetch(`/api/community/posts/${encodeURIComponent(postId)}/favorite`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return (await res.json()) as TogglePostActionResponse;
  } catch {
    return null;
  }
}

export async function postCommunityComment(
  postId: string,
  input: CreateCommunityCommentInput,
): Promise<CommunityComment | null> {
  try {
    const res = await authFetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as CommunityComment;
  } catch {
    return null;
  }
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await authFetch('/api/auth/profile');
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

export async function updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfile | null> {
  try {
    const res = await authFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}
