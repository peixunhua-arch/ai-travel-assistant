// 「我的」页偏好卡片（UX §7.5）：让个人闭环「被看见」。
import { View, Text, StyleSheet } from 'react-native';
import type { UserPreferences } from '@travel/shared';
import { colors, spacing, font } from '../theme';

export function PreferenceCard({
  prefs,
  embedded,
}: {
  prefs: UserPreferences | null;
  embedded?: boolean;
}) {
  const wrapStyle = embedded ? styles.embedded : styles.card;

  if (!prefs || prefs.reviewCount === 0) {
    return (
      <View style={wrapStyle}>
        <Text style={styles.empty}>还没有评价记录，体验行程后赞/踩我会记住偏好。</Text>
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      {prefs.liked.length > 0 && (
        <Text style={styles.line} numberOfLines={2}>
          <Text style={styles.key}>偏好 </Text>
          {prefs.liked.join('、')}
        </Text>
      )}
      {prefs.disliked.length > 0 && (
        <Text style={styles.line} numberOfLines={2}>
          <Text style={styles.key}>避雷 </Text>
          {prefs.disliked.join('、')}
        </Text>
      )}
      <Text style={styles.meta}>基于最近 {prefs.reviewCount} 条评价</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    gap: 4,
  },
  embedded: {
    gap: 4,
  },
  empty: {
    fontSize: font.tiny.size,
    lineHeight: 18,
    color: colors.textMuted,
  },
  line: {
    fontSize: font.tiny.size,
    lineHeight: 18,
    color: colors.textMuted,
  },
  key: { color: colors.textStrong, fontWeight: '700' },
  meta: { fontSize: 11, color: colors.textPlaceholder, marginTop: 2 },
});
