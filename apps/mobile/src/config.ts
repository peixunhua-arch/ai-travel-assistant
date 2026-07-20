// 后端地址配置。
//
// ⚠️ 手机真机（Expo Go）不能用 localhost —— 那指的是手机自己，不是你的电脑。
// 必须用「电脑在局域网里的 IP」，手机和电脑要连同一个 WiFi。
//
// 当前电脑 IP 是自动探测填进来的；如果换了 WiFi 或 IP 变了，改这一行即可。
// 怎么查电脑 IP：Windows 命令行输 ipconfig，找「无线局域网适配器 WLAN」下的 IPv4 地址。
//
// 也可以用环境变量覆盖（EXPO_PUBLIC_ 前缀的变量会自动注入到 App 里）。
/** 打包默认后端地址；运行时以 apiBase.ts（「我的」可改）为准。
 * 默认走 USB adb reverse（http://127.0.0.1:3000）；同网 WiFi 时可在「我的」改回局域网 IP。
 */
export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000';

/** @deprecated 请用 getApiBaseUrl()；保留别名避免漏改导致编译失败 */
export const API_BASE_URL = DEFAULT_API_BASE_URL;

// ===== 高德「Web端(JS API)」地图 key（阶段 3，前端地图专用）=====
//
// ⚠️ 这把 key 和后端 .env 里的 AMAP_WEB_KEY 是「两把不同的 key」，别混：
//   - 后端 AMAP_WEB_KEY → 高德「Web 服务」应用（服务端搜 POI，restapi.amap.com 用）
//   - 这里 AMAP_JS_KEY  → 高德「Web端(JS API)」应用（浏览器/WebView 里画地图，webapi.amap.com 用）
// 两者在高德控制台是分开建的两个「应用」，各有各的 key。
//
// securityJsCode 是 JS API 2.0 的「安全密钥」，会随 JS bundle 打进客户端（高德 JS API 的设计如此，
// 属于「弱密钥」，可接受）。在控制台建 JS 应用时和 key 一起给，并要配好域名白名单。
//
// ⚠️ 现在这两个还是空的——需要你去高德开放平台建「Web端(JS API)」应用后填进来。
// 在填之前：TripMap 组件检测到 key 为空会自动「不显示地图」，其余功能（真实数据、天气、跳转）
// 全部照常工作，不受影响。
export const AMAP_JS_KEY = process.env.EXPO_PUBLIC_AMAP_JS_KEY ?? 'cd28e22d24f336d45601a5c16a27882d';
export const AMAP_JS_SECURITY = process.env.EXPO_PUBLIC_AMAP_JS_SECURITY ?? 'ae57ccbb465fa8bce6d1f668ece07bc0';
