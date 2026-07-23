// 后端连通性提示条：App 启动时悄悄 ping 一下后端（GET /health）。
// 连不上就在顶部挂一条黄色横幅，提醒用户「不是 App 坏了，是没连上后端」。
//
// 为什么值得做？这个项目的后端跑在用户自己电脑上，手机靠同一 WiFi 访问。
// 一旦电脑没开服务、或手机连错网、或电脑 IP 变了，用户只会看到「发消息失败」，
// 一头雾水。提前预检 + 一句明确的话（检查后端与 WiFi），能省掉大量排查。
//
// 自愈：连不上时黄条上带「重试」；用户把后端开起来后点一下，通了黄条就消失。
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { checkHealth } from '../api';
import { colors, spacing, font } from '../theme';

export function HealthBanner() {
  // null=还没测出结果（先不显示任何东西，避免闪一下）
  const [ok, setOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(async () => {
    setChecking(true);
    const healthy = await checkHealth();
    setOk(healthy);
    setChecking(false);
  }, []);

  // 挂载时自动测一次
  useEffect(() => {
    run();
  }, [run]);

  // 没测完、或一切正常：不占地方
  if (ok === null || ok === true) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⚠️ 连不上服务器。若在会议室/访客 WiFi，请关掉 WiFi 改用手机流量，或到「我的 → 服务器」点测试连接
      </Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={run}
        disabled={checking}
        accessibilityRole="button"
        accessibilityLabel="重试连接后端"
      >
        <Text style={styles.retryText}>{checking ? '检测中…' : '重试'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.warningBorder,
  },
  text: {
    flex: 1,
    color: colors.warningText,
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryText: {
    color: colors.warningText,
    fontSize: font.tiny.size,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
