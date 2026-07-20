// 「当日总览条」：站数、类型、预算、户外/室内占比（§5.5 启发式）。
import { View, Text, StyleSheet } from 'react-native';
import type { TripItem } from '@travel/shared';
import { TRIP_TYPE_META } from '../tripTypes';
import { colors, spacing, radius, font } from '../theme';

const COUNTED_TYPES = ['sight', 'food', 'hotel'] as const;

/** 景点默认户外；美食/住宿默认室内（启发式，非精确） */
function isOutdoorLikely(item: TripItem): boolean {
  if (item.type === 'sight') {
    const name = item.name + item.description;
    if (/博物馆|美术馆|商场|室内|展览|馆|寺|庙/.test(name)) return false;
    return true;
  }
  return false;
}

export function DaySummaryBar({
  items,
  budgetPerDay,
}: {
  items: TripItem[];
  budgetPerDay?: number;
}) {
  const stops = items.filter((it) => it.type !== 'transport');
  if (stops.length === 0) return null;

  const counts = COUNTED_TYPES.map((type) => ({
    type,
    n: stops.filter((it) => it.type === type).length,
  })).filter((c) => c.n > 0);

  const outdoor = stops.filter(isOutdoorLikely).length;
  const indoor = stops.length - outdoor;
  const outdoorPct = Math.round((outdoor / stops.length) * 100);

  const parts = [
    `共 ${stops.length} 站`,
    ...counts.map((c) => `${c.n} ${TRIP_TYPE_META[c.type].label}`),
  ];
  if (budgetPerDay && budgetPerDay > 0) {
    parts.push(`约 ${budgetPerDay} 元/天`);
  }
  if (outdoor > 0 || indoor > 0) {
    parts.push(`户外约 ${outdoorPct}%`);
  }

  return (
    <View style={styles.bar}>
      <Text style={styles.text} allowFontScaling>
        {parts.join('  ·  ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    color: colors.textMuted,
  },
});
