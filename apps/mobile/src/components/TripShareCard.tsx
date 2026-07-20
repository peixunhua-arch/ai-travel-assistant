// §8.3 长图分享卡片：离屏渲染后由 view-shot 截图分享。
import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SavedTrip, TripGenerateResponse } from '@travel/shared';
import { TRIP_TYPE_META } from '../tripTypes';
import { colors, spacing, radius, font } from '../theme';

type ShareableTrip = Pick<
  SavedTrip | TripGenerateResponse,
  'destination' | 'daysCount' | 'budgetEstimate' | 'days'
>;

export const TripShareCard = forwardRef<View, { trip: ShareableTrip }>(function TripShareCard(
  { trip },
  ref,
) {
  const budget =
    trip.budgetEstimate > 0 ? `预算约 ${trip.budgetEstimate} 元` : '预算不限';

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={styles.header}>
        <Text style={styles.brand}>途灵</Text>
        <Text style={styles.dest}>{trip.destination}</Text>
        <Text style={styles.meta}>
          {trip.daysCount} 天 · {budget}
        </Text>
      </View>

      {trip.days.map((day) => (
        <View key={day.day} style={styles.dayBlock}>
          <Text style={styles.dayTitle}>
            第 {day.day} 天 · {day.theme}
          </Text>
          {day.items.map((item, i) => {
            const meta = TRIP_TYPE_META[item.type];
            return (
              <View key={`${item.time}-${i}`} style={styles.item}>
                <Text style={styles.itemLine}>
                  {item.time} {meta.emoji} {item.name}
                </Text>
                {item.address ? (
                  <Text style={styles.itemSub}>📍 {item.address}</Text>
                ) : null}
                <Text style={styles.itemDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      <Text style={styles.disclaimer}>
        行程由 AI 生成，仅供参考，请以实际营业时间与价格为准
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  brand: {
    fontSize: font.tiny.size,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  dest: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textOnAccent,
  },
  meta: {
    fontSize: font.small.size,
    color: 'rgba(255,255,255,0.92)',
  },
  dayBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dayTitle: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.xs,
  },
  item: { gap: 2 },
  itemLine: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
  itemDesc: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    lineHeight: 16,
  },
  disclaimer: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingTop: spacing.sm,
  },
});
