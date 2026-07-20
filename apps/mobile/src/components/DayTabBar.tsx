// §5.1 多日行程 Day Tab：横向切换查看某一天。
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export function DayTabBar({
  days,
  activeDay,
  onSelect,
}: {
  days: number[];
  activeDay: number;
  onSelect: (day: number) => void;
}) {
  if (days.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((d) => {
        const active = d === activeDay;
        return (
          <TouchableOpacity
            key={d}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onSelect(d)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`第 ${d} 天`}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>Day {d}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLight,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: font.small.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },
});
