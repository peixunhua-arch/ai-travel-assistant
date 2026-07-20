// 「一天」的行程块：标题「第 N 天 · 主题」+ 当天所有条目（TripItemCard）竖排。
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { TripDay, ReviewState, PoiReputation } from '@travel/shared';
import { TripItemCard } from './TripItemCard';
import { DaySummaryBar } from './DaySummaryBar';
import { CommuteHint } from './CommuteHint';
import { colors, spacing, radius, font } from '../theme';

export function DayPlan({
  day,
  poiReviews,
  reputations,
  onPoiReview,
  canReview,
  collapsible,
  highlightedMapIndex = null,
  budgetPerDay,
  onSelectMapIndex,
  onRegisterMapOffset,
  pendingPoiIds,
  isSparse,
  onRegenerateDay,
  isFailed,
}: {
  day: TripDay;
  poiReviews?: Record<string, ReviewState>;
  reputations?: Record<string, PoiReputation>;
  onPoiReview?: (poiId: string, sentiment: 1 | -1, tags: string[], comment?: string) => void;
  canReview?: boolean;
  /** §5.1 详情页默认收起简介 */
  collapsible?: boolean;
  /** §5.2 地图联动高亮 */
  highlightedMapIndex?: number | null;
  budgetPerDay?: number;
  onSelectMapIndex?: (mapIndex: number) => void;
  onRegisterMapOffset?: (mapIndex: number, y: number) => void;
  pendingPoiIds?: Set<string>;
  /** §6.3 当天安排过少 */
  isSparse?: boolean;
  onRegenerateDay?: () => void;
  /** §6.6 部分成功：该天生成失败 */
  isFailed?: boolean;
}) {
  const mapIndexByItem = new Map<number, number>();
  let mi = 0;
  day.items.forEach((it, i) => {
    if (it.type === 'transport') return;
    if (typeof it.lat === 'number' && typeof it.lng === 'number') {
      mapIndexByItem.set(i, mi++);
    }
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        第 {day.day} 天 · {day.theme}
      </Text>
      <DaySummaryBar
        items={day.items}
        budgetPerDay={
          budgetPerDay && budgetPerDay > 0 ? Math.round(budgetPerDay) : undefined
        }
      />
      <View style={styles.items}>
        {(isFailed || isSparse || day.items.length === 0) && (
          <TouchableOpacity
            style={[styles.sparseBox, isFailed && styles.failedBox]}
            onPress={onRegenerateDay}
            disabled={!onRegenerateDay}
            accessibilityRole="button"
            accessibilityLabel={
              isFailed ? '本日生成失败，点此重试' : '这天安排较少，点此重新生成本日'
            }
          >
            <Text style={styles.sparseTitle}>
              {isFailed ? '本日生成失败' : '这天安排较少'}
            </Text>
            <Text style={styles.sparseBody}>
              {onRegenerateDay ? '点此重新生成本日行程' : '可返回重新生成整份行程'}
            </Text>
          </TouchableOpacity>
        )}
        {day.items.map((item, i) => {
          const prev = i > 0 ? day.items[i - 1] : null;
          const mapIdx = mapIndexByItem.get(i);
          return (
            <View
              key={`${item.time}-${i}`}
              onLayout={
                mapIdx !== undefined && onRegisterMapOffset
                  ? (e) => onRegisterMapOffset(mapIdx, 96 + e.nativeEvent.layout.y)
                  : undefined
              }
            >
              {i > 0 && (
                <CommuteHint
                  fromLat={prev?.lat}
                  fromLng={prev?.lng}
                  toLat={item.lat}
                  toLng={item.lng}
                />
              )}
              <TripItemCard
                item={item}
                review={item.poiId ? poiReviews?.[item.poiId] : undefined}
                reputation={item.poiId ? reputations?.[item.poiId] : undefined}
                onReview={
                  item.poiId && onPoiReview
                    ? (sentiment, tags, comment) =>
                        onPoiReview(item.poiId!, sentiment, tags, comment)
                    : undefined
                }
                reviewDisabled={!canReview}
                collapsible={collapsible}
                highlighted={mapIdx !== undefined && mapIdx === highlightedMapIndex}
                onSelectMap={
                  mapIdx !== undefined && onSelectMapIndex
                    ? () => onSelectMapIndex(mapIdx)
                    : undefined
                }
                pendingSync={item.poiId ? pendingPoiIds?.has(item.poiId) : false}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.md,
  },
  items: {
    gap: spacing.lg,
  },
  sparseBox: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warningBorder,
    minHeight: 44,
    justifyContent: 'center',
  },
  sparseTitle: {
    fontSize: font.small.size,
    fontWeight: '700',
    color: colors.warningText,
    marginBottom: spacing.xs,
  },
  sparseBody: {
    fontSize: font.tiny.size,
    color: colors.warningText,
    textDecorationLine: 'underline',
  },
  failedBox: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
});
