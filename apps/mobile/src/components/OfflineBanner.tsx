// 离线模式提示条（UX §6.5）：断网时顶部显示，告知用户当前看的是本地缓存内容。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, font, radius } from '../theme';

export function OfflineBanner({ pendingReviews }: { pendingReviews?: number }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>离线模式 · 显示本地已保存的行程</Text>
      {pendingReviews && pendingReviews > 0 ? (
        <Text style={styles.sub}>
          有 {pendingReviews} 条评价待联网后同步
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warningBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.warningBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  text: {
    fontSize: font.small.size,
    color: colors.warningText,
    fontWeight: '600',
  },
  sub: {
    fontSize: font.tiny.size,
    color: colors.warningText,
  },
});
