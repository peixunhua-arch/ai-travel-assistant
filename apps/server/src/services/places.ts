// 高德 POI 搜索封装（阶段 3）。给 Claude 的 search_place 工具用：搜真实的餐厅/景点/酒店，
// 拿到名字、评分、坐标、地址——这样行程里就不是模型瞎编的店名，而是地图上真实存在的点。
//
// 用的是「高德 Web 服务 API」（restapi.amap.com），key 是 AMAP_WEB_KEY（.env 已配）。
// 注意：这把 key 和前端地图要用的「Web端(JS API)」key 是两把，别混。
//
// ⚠️ 三个高德返回的坑，下面代码逐个防住了：
//   1) 顶层状态字段叫 status，值是字符串 "1"（成功）/"0"（失败），不是布尔。
//   2) location 是「经度,纬度」一个字符串，且经度在前（和数学习惯的 (纬,经) 相反）；坐标系是 GCJ-02。
//   3) 某些 POI 没评分/没地址时，高德不是给 null，而是给一个空数组 []——直接当字符串用会出错。

// 后端内部用的 POI 形状（也是回填进行程 item 的来源）。
export interface Poi {
  poiId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number; // 高德没给评分时就是 undefined
  photoUrl?: string; // 高德首图 url（没图就是 undefined）
  opentime?: string; // 营业时间（extensions=all 时 biz_ext.open_time）
  type: 'food' | 'sight' | 'hotel';
}

const KEY = process.env.AMAP_WEB_KEY;

// 高德返回的单条 POI（只列用到的字段；address/biz_ext 可能是 string 也可能是空数组 []）。
interface AmapPoi {
  id: string;
  name: string;
  location: string; // "104.0552,30.6634"（经,纬）
  address?: string | unknown[];
  biz_ext?: { rating?: string | unknown[]; open_time?: string | unknown[] } | unknown[];
  // photos：图片数组，每项 { title, url }。title 常是空数组噪声，只取 url。无图时可能是空数组。
  photos?: { title?: unknown; url?: string }[];
}

// 高德有时把「本该是字符串的字段」在无值时返回成空数组 []。这个小工具统一处理：
// 是非空字符串就返回它，否则返回空串。
function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// 取 POI 首图 url。两个坑都在这兜住：
//   1) photos 可能缺/是空数组 → 返回 undefined（没图）；
//   2) 部分 url 是 http://（iOS ATS 会拦掉不加载）→ 统一升成 https://（高德图床同域名支持 https）。
function firstPhotoUrl(photos: AmapPoi['photos']): string | undefined {
  const url = photos?.[0]?.url;
  if (typeof url !== 'string' || !url) return undefined;
  return url.replace(/^http:\/\//, 'https://');
}

/**
 * 搜索高德 POI。
 * @param city    城市名，如「成都」
 * @param keyword 搜索词，如「川菜」「宽窄巷子」
 * @param type    POI 类型（food/sight/hotel），原样带回，方便 Claude 对应回填
 * 返回最多 10 条 Poi；搜不到返回空数组。key 没配或接口报错时抛 Error（executeTool 会兜住）。
 */
export async function searchPlace(
  city: string,
  keyword: string,
  type: 'food' | 'sight' | 'hotel',
): Promise<Poi[]> {
  if (!KEY) throw new Error('高德未配置（缺 AMAP_WEB_KEY）');

  // citylimit=true 把结果限制在该城市内，避免搜「火锅」搜出全国；
  // offset=10 是「每页条数」（高德 v3 的命名，不是偏移量），即返回 10 条；extensions=all 才带评分等详情。
  const url =
    `https://restapi.amap.com/v3/place/text?key=${KEY}` +
    `&keywords=${encodeURIComponent(keyword)}` +
    `&city=${encodeURIComponent(city)}` +
    `&citylimit=true&offset=10&extensions=all`;

  const res = await fetch(url);
  const data = (await res.json()) as { status?: string; info?: string; pois?: AmapPoi[] };
  // status 是字符串 "1" 才算成功。
  if (data.status !== '1') {
    throw new Error(`高德搜索失败：${data.info ?? '未知错误'}`);
  }
  if (!data.pois?.length) return [];

  const out: Poi[] = [];
  for (const p of data.pois) {
    // location 形如 "经,纬"，拆出来注意经度在前。
    const [lngStr, latStr] = (p.location ?? '').split(',');
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);
    // 没有有效坐标的点直接跳过（上不了地图，留着也没用）。
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    // biz_ext 可能是对象、也可能是空数组；rating 可能是字符串、也可能缺。层层防御。
    const bizExt = Array.isArray(p.biz_ext) ? undefined : p.biz_ext;
    const rating = bizExt ? parseFloat(asStr(bizExt.rating)) || undefined : undefined;
    const opentime = bizExt ? asStr(bizExt.open_time) || undefined : undefined;

    out.push({
      poiId: p.id,
      name: p.name,
      address: asStr(p.address),
      lat,
      lng,
      rating,
      photoUrl: firstPhotoUrl(p.photos),
      opentime,
      type,
    });
  }
  return out;
}
