// 跳转链接拼装（阶段 3）。原则：链接一律由后端按规则拼，不让 Claude 生成（它会编错格式）。
//
// 为什么不直接抓小红书/大众点评的数据？——它们没有面向个人开发者的开放 API，爬虫还有法律风险。
// 所以我们只做「跳转」：拼一个搜索链接，用户点了跳过去，在对方 App/网页里看真实笔记和点评。
// 因此会出现「小红书能搜到、点评搜不到」——各平台收录不同，属正常，不是数据抓取失败。
//
// 每个平台给两条链接：
//   scheme（如 dianpingsearchshoplist://…）—— 手机装了对应 App 时，能直接唤起 App；
//   网页 url —— 没装 App 时的兜底，用浏览器打开。
// 前端 openLink() 会先试 scheme，不行再退回网页。

// 大众点评的城市 ID（它的 URL 里要用数字 ID，不是城市名）。常见几个，按需扩展。
// ⚠️ 坑：不能写死 1（那是上海），否则搜北京的店会跳到上海去。未知城市兜底用 2（北京）。
const DIANPING_CITY: Record<string, number> = {
  上海: 1,
  北京: 2,
  杭州: 3,
  广州: 4,
  深圳: 7,
  成都: 8,
  重庆: 9,
  西安: 17,
  南京: 5,
  武汉: 16,
};

/**
 * 给一个地点名 + 城市，拼出「导航 / 小红书 / 大众点评」的跳转链接（各含 scheme + 网页两种）。
 * 结构和 shared 里 TripItem.links 完全对应。
 */
export function buildLinks(name: string, city: string) {
  const cityId = DIANPING_CITY[city] ?? 2; // 未知城市兜底北京，比落到 0（无效）稳
  const kw = encodeURIComponent(name); // 只有店名（大众点评 url 里城市已用 id 表达）
  const cityKw = encodeURIComponent(`${city} ${name}`); // 「城市 店名」，给地图/小红书更准

  return {
    // 大众点评：/search/keyword/{cityId}/0_{关键词}
    dianpingUrl: `https://www.dianping.com/search/keyword/${cityId}/0_${kw}`,
    // 小红书：网页搜索结果页
    xhsUrl: `https://www.xiaohongshu.com/search_result?keyword=${cityKw}`,
    // 高德网页版搜索（点了能看位置/导航），最稳的兜底
    mapUrl: `https://uri.amap.com/search?keyword=${cityKw}`,
    // App scheme（配合前端 canOpenURL 兜底；格式可能随 App 版本变，兜底网页永远可用）
    xhsScheme: `xhsdiscover://search/result?keyword=${cityKw}`,
    dianpingScheme: `dianping://searchshoplist?keyword=${cityKw}`,
  };
}
