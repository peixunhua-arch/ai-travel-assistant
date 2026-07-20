// 评价进度条（UX §7.5）：详情页展示「已评价 N/M 个地点」，激励补全单点评价。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export function ReviewProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const ratio = Math.min(1, done / total);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>地点评价进度</Text>
        <Text style={styles.count}>
          {done}/{total}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      {done < total && (
        <Text style={styles.hint}>体验后点个评价，下次推荐会更贴合你的口味</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: font.body.size, fontWeight: '600', color: colors.textStrong },
  count: { fontSize: font.small.size, color: colors.textMuted, fontWeight: '600' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  hint: { fontSize: font.tiny.size, color: colors.textMuted, lineHeight: font.tiny.lineHeight },
});
