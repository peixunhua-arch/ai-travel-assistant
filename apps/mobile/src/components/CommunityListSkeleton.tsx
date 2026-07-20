// 社区瀑布流骨架。
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing } from '../theme';

export function CommunityListSkeleton() {
  const { width } = useWindowDimensions();
  const colW = (width - spacing.md * 2 - spacing.sm) / 2;
  const heights = [160, 200, 140, 180];

  return (
    <View style={styles.wrap}>
      <View style={styles.col}>
        {[0, 2].map((i) => (
          <View key={i} style={[styles.card, { width: colW }]}>
            <View style={[styles.cover, { height: heights[i] }]} />
            <View style={styles.line} />
            <View style={styles.lineSm} />
          </View>
        ))}
      </View>
      <View style={styles.col}>
        {[1, 3].map((i) => (
          <View key={i} style={[styles.card, { width: colW }]}>
            <View style={[styles.cover, { height: heights[i] }]} />
            <View style={styles.line} />
            <View style={styles.lineSm} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  cover: {
    width: '100%',
    backgroundColor: colors.inputBg,
  },
  line: {
    height: 12,
    width: '80%',
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    margin: 8,
  },
  lineSm: {
    height: 10,
    width: '45%',
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    marginHorizontal: 8,
    marginBottom: 10,
  },
});
