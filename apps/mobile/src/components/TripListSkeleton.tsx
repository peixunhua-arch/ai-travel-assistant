// 列表加载骨架屏（UX §5.3）。
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

export function TripListSkeleton() {
  return (
    <View style={styles.wrap}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.lineLg} />
          <View style={styles.lineSm} />
          <View style={styles.lineXs} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  lineLg: {
    height: 18,
    width: '45%',
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
  },
  lineSm: {
    height: 14,
    width: '60%',
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
  },
  lineXs: {
    height: 12,
    width: '30%',
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
  },
});
