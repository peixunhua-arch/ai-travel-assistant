/**
 * RN 0.81 Event 相位常量为只读，whatwg-fetch / event-target-shim 写入时会崩溃。
 * 在加载真正的 whatwg-fetch 之前，先把这些常量改为可写。
 */
function ensureWritableEventPhaseConstants() {
  const EventRef = global.Event;
  if (!EventRef) return;
  const keys = ['NONE', 'CAPTURING_PHASE', 'AT_TARGET', 'BUBBLING_PHASE'];
  for (const key of keys) {
    for (const target of [EventRef, EventRef.prototype]) {
      if (!target || !(key in target)) continue;
      try {
        const desc = Object.getOwnPropertyDescriptor(target, key);
        if (!desc) continue;
        Object.defineProperty(target, key, {
          ...desc,
          writable: true,
          configurable: true,
        });
      } catch {
        // already writable or non-configurable — ignore
      }
    }
  }
}

ensureWritableEventPhaseConstants();

// 用绝对子路径加载真模块，避免再次被 metro alias 指回本文件
require('../../../node_modules/.pnpm/node_modules/whatwg-fetch/dist/fetch.umd.js');
