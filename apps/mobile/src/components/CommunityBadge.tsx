// 社区口碑角标（UX §7.3）：reviewCount > 0 才显示，冷启动隐藏。
import { View, Text, StyleSheet } from 'react-native';
import type { PoiReputation } from '@travel/shared';
import { colors, spacing, radius, font } from '../theme';

export function CommunityBadge({ reputation }: { reputation: PoiReputation }) {
  if (reputation.reviewCount === 0) return null;

  const pct = Math.round(reputation.likeRatio * 100);
  const tagHint = reputation.topTags.length > 0 ? ` · ${reputation.topTags[0]}` : '';

  return (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>
        社区好评 {pct}%（{reputation.reviewCount} 人评）{tagHint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.successBg,
  },
  text: {
    fontSize: font.tiny.size,
    color: colors.success,
    fontWeight: '600',
  },
});
