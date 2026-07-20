import type { Href, Router } from 'expo-router';

/** 打开行程详情（统一用字符串路径，避免动态路由对象写法在部分机型失效）。 */
export function openTripDetail(router: Router, tripId: string) {
  const id = tripId?.trim();
  if (!id || id.startsWith('saving-')) return;
  router.push(`/trip/${id}`);
}

/**
 * 安全返回：栈里有上一页就 back，否则落到 fallback。
 * 避免「GO_BACK was not handled by any navigator」开发期红屏。
 */
export function safeGoBack(router: Router, fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
