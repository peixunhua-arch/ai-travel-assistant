// 和风天气封装（阶段 3）。给 Claude 的 get_weather 工具用：查目的地未来 3 天天气，
// 好让它「下雨天多排室内、晴天排户外」。
//
// 和风的调用要两步（这是新手最容易懵的点）：
//   第 1 步：城市名 → LocationID（和风不认「成都」这种名字，只认内部 ID，如 101270101）
//   第 2 步：用 LocationID 查 3 天预报
//
// 两个 host 是不一样的（.env 里分开配）：
//   GeoAPI（查 ID）走 QWEATHER_GEO_HOST，天气预报走 QWEATHER_API_HOST（控制台给每人分配的专属域名）。
// 认证统一用请求头 X-QW-Api-Key。
//
// ⚠️ 坑：和风返回体里的 code 是「字符串」"200" 不是数字 200，判等一定要带引号。
import type { WeatherDay } from '@travel/shared';

// .env 里存的 host 不带 https:// 前缀，这里统一补上。
const GEO_HOST = process.env.QWEATHER_GEO_HOST; // geoapi.qweatherapi.com
const API_HOST = process.env.QWEATHER_API_HOST; // xxx.re.qweatherapi.com（控制台分配）
const KEY = process.env.QWEATHER_KEY;

// 和风 3 天预报里每天一条的原始形状（只列我们用到的字段）。
interface QWeatherDaily {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  iconDay?: string;
}

/**
 * 查某城市未来 3 天天气。
 * 返回 { days, summary }：
 *   days    —— 结构化的 3 天数据，最终会挂到行程响应上给前端画「天气条」。
 *   summary —— 一句话人话摘要，喂回给 Claude 当工具结果（模型看这句就够决策了）。
 * 查不到（未知城市 / key 没配 / 接口报错）时抛 Error，调用方（executeTool）会 try/catch 兜住。
 */
export async function getWeather(city: string): Promise<{ days: WeatherDay[]; summary: string }> {
  if (!KEY || !GEO_HOST || !API_HOST) {
    throw new Error('和风天气未配置（缺 QWEATHER_KEY / HOST）');
  }
  const headers = { 'X-QW-Api-Key': KEY };

  // 第 1 步：城市名 → LocationID。range=cn 限定国内，number=1 只要最匹配的一个。
  const geoUrl = `https://${GEO_HOST}/geo/v2/city/lookup?location=${encodeURIComponent(city)}&range=cn&number=1`;
  const geoRes = await fetch(geoUrl, { headers });
  const geoData = (await geoRes.json()) as {
    code?: string;
    location?: { id: string }[];
  };
  // code 是字符串 "200"；同时要确认真的查到了城市（location 数组非空），否则下一行会崩。
  if (geoData.code !== '200' || !geoData.location?.length) {
    throw new Error(`未找到城市「${city}」的天气（code=${geoData.code}）`);
  }
  const locationId = geoData.location[0].id;

  // 第 2 步：用 LocationID 查 3 天预报。（Node18+ 的 fetch 会自动解 gzip，不用手动处理。）
  const wxUrl = `https://${API_HOST}/v7/weather/3d?location=${locationId}`;
  const wxRes = await fetch(wxUrl, { headers });
  const wxData = (await wxRes.json()) as { code?: string; daily?: QWeatherDaily[] };
  if (wxData.code !== '200' || !wxData.daily?.length) {
    throw new Error(`天气查询失败（code=${wxData.code}）`);
  }

  // 只取需要的字段，转成我们自己的 WeatherDay（字段名和前端、共享类型对齐）。
  const days: WeatherDay[] = wxData.daily.map((d) => ({
    date: d.fxDate,
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    textDay: d.textDay,
    iconDay: d.iconDay,
  }));

  // 拼一句给 Claude 看的摘要，如：「成都未来3天：多云 24~34℃；小雨 22~30℃；晴 25~35℃」
  const summary =
    `${city}未来${days.length}天：` +
    days.map((d) => `${d.textDay} ${d.tempMin}~${d.tempMax}℃`).join('；');

  return { days, summary };
}
