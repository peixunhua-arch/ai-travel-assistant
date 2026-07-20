// 跳转外部 App / 网页的工具函数（阶段 3）。
//
// 后端 buildLinks 给每个平台拼了两条链接：
//   scheme（如 xhsdiscover://…）—— 手机装了对应 App 时能直接唤起 App，体验最好；
//   web  （如 https://…）      —— 没装 App 时的兜底，用系统浏览器打开。
//
// openLink 的策略：先问系统「能打开这个 scheme 吗」，能就唤起 App，不能就退回网页。
//
// ⚠️ iOS 上 canOpenURL 有个坑：想查询的 scheme 必须先在 app.json 的
//   ios.infoPlist.LSApplicationQueriesSchemes 里登记，否则一律返回 false（查不到=当没装）。
//   我们已在 app.json 配了 xhsdiscover / dianping / iosamap。Android/Expo Go 无此限制。
import { Alert, Linking } from 'react-native';
import { checkOnline } from './network';
import { openInAppWebView } from './components/ExternalLinkModal';

/** 是否第三方 App/网页跳转（需二次确认，UX §10） */
function isThirdPartyLink(scheme: string, web: string): boolean {
  return (
    scheme.startsWith('xhsdiscover://') ||
    scheme.startsWith('dianping://') ||
    web.includes('xiaohongshu.com') ||
    web.includes('dianping.com')
  );
}

function confirmThirdParty(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('打开第三方应用', '将跳转到小红书或大众点评查看相关内容，是否继续？', [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '继续', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * 打开一个链接：优先唤起 App（scheme），失败则退回网页（web）。
 * 离线时提示用户需要联网（UX §6.5）。
 */
export async function openLink(scheme: string, web: string): Promise<void> {
  const online = await checkOnline();
  if (!online) {
    Alert.alert('需要联网', '查看地图/小红书/大众点评需要网络连接');
    return;
  }

  if (isThirdPartyLink(scheme, web)) {
    const ok = await confirmThirdParty();
    if (!ok) return;
  }

  try {
    const canOpen = await Linking.canOpenURL(scheme);
    if (canOpen) {
      await Linking.openURL(scheme);
      return;
    }
  } catch {
    // canOpenURL/openURL 偶尔会抛——不崩，直接走网页兜底。
  }
  try {
    await Linking.openURL(web);
  } catch {
    openInAppWebView(web, '第三方页面');
  }
}
