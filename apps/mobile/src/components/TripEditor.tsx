// 行程编辑态（UX §5.4）：删点、改时间、拖拽排序。保存写回本地 AsyncStorage。
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { TimePickerField } from './TimePickerField';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { SavedTrip, TripDay, TripItem } from '@travel/shared';
import { TRIP_TYPE_META } from '../tripTypes';
import { colors, spacing, radius, font } from '../theme';
import { MIN_TOUCH, hitSlopMd } from '../lib/a11y';

function cloneTrip(trip: SavedTrip): SavedTrip {
  return JSON.parse(JSON.stringify(trip)) as SavedTrip;
}

function DayItemList({
  day,
  dayIndex,
  onUpdateDay,
  onDeleteItem,
}: {
  day: TripDay;
  dayIndex: number;
  onUpdateDay: (dayIndex: number, nextDay: TripDay) => void;
  onDeleteItem: (dayIndex: number, itemIndex: number) => void;
}) {
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<TripItem>) => {
    const ii = getIndex() ?? 0;
    const meta = TRIP_TYPE_META[item.type];
    return (
      <ScaleDecorator>
        <View style={[styles.itemRow, isActive && styles.itemDragging]}>
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={120}
            style={styles.dragHandle}
            accessibilityRole="button"
            accessibilityLabel={`拖动调整 ${item.name} 的顺序`}
            accessibilityHint="长按后上下拖动排序"
            hitSlop={hitSlopMd}
          >
            <Text style={styles.dragIcon}>≡</Text>
          </TouchableOpacity>
          <Text style={styles.emoji} accessibilityLabel={meta.label}>{meta.emoji}</Text>
          <View style={styles.itemBody}>
            <TimePickerField
              value={item.time}
              onChange={(t) => {
                const items = day.items.map((it, i) => (i === ii ? { ...it, time: t } : it));
                onUpdateDay(dayIndex, { ...day, items });
              }}
              label={`修改 ${item.name} 的时间`}
            />
            <Text style={styles.name} numberOfLines={2} allowFontScaling>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={() => onDeleteItem(dayIndex, ii)}
              accessibilityRole="button"
              accessibilityLabel={`删除 ${item.name}`}
              hitSlop={hitSlopMd}
            >
              <Text style={styles.deleteText}>删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <DraggableFlatList
      data={day.items}
      keyExtractor={(item, index) => `${item.time}-${item.name}-${index}`}
      renderItem={renderItem}
      onDragEnd={({ data }) => onUpdateDay(dayIndex, { ...day, items: data })}
      containerStyle={styles.listGap}
    />
  );
}

export function TripEditor({
  trip,
  onSave,
  onCancel,
}: {
  trip: SavedTrip;
  onSave: (updated: SavedTrip) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => cloneTrip(trip));
  const baseline = JSON.stringify(trip);

  const isDirty = JSON.stringify(draft) !== baseline;

  const handleCancel = () => {
    if (!isDirty) {
      onCancel();
      return;
    }
    Alert.alert('放弃修改？', '未保存的编辑将丢失', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: onCancel },
    ]);
  };

  const updateDay = (dayIndex: number, nextDay: TripDay) => {
    setDraft((prev) => {
      const days = [...prev.days];
      days[dayIndex] = nextDay;
      return { ...prev, days };
    });
  };

  const deleteItem = (dayIndex: number, itemIndex: number) => {
    const day = draft.days[dayIndex];
    const item = day.items[itemIndex];
    Alert.alert('删除此项？', `确定删除「${item.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const items = day.items.filter((_, i) => i !== itemIndex);
          if (items.length === 0) {
            Alert.alert('这天已空', '当天没有安排了，是否删除整天？', [
              { text: '保留空天', onPress: () => updateDay(dayIndex, { ...day, items: [] }) },
              {
                text: '删除整天',
                style: 'destructive',
                onPress: () => {
                  setDraft((prev) => ({
                    ...prev,
                    days: prev.days.filter((d) => d.day !== day.day),
                  }));
                },
              },
            ]);
          } else {
            updateDay(dayIndex, { ...day, items });
          }
        },
      },
    ]);
  };

  const handleSave = () => {
    const cleaned = {
      ...draft,
      days: draft.days.filter((d) => d.items.length > 0),
      daysCount: draft.days.filter((d) => d.items.length > 0).length,
    };
    onSave(cleaned);
  };

  return (
    <GestureHandlerRootView style={styles.wrap}>
      <Text style={styles.hint}>长按 ≡ 拖动可调整同一天内的顺序</Text>
      {draft.days.map((day, di) => (
        <View key={day.day} style={styles.dayCard}>
          <Text style={styles.dayTitle} allowFontScaling>
            第 {day.day} 天 · {day.theme}
          </Text>
          <DayItemList
            day={day}
            dayIndex={di}
            onUpdateDay={updateDay}
            onDeleteItem={deleteItem}
          />
        </View>
      ))}

      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="放弃编辑"
        >
          <Text style={styles.cancelText}>放弃</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="保存修改"
        >
          <Text style={styles.saveText}>保存修改</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.xl },
  hint: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  dayTitle: { fontSize: font.body.size, fontWeight: '700', color: colors.textStrong },
  listGap: { gap: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  itemDragging: {
    opacity: 0.92,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dragHandle: {
    width: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragIcon: { fontSize: 22, color: colors.textMuted, fontWeight: '700' },
  emoji: { fontSize: 18, marginTop: 8 },
  itemBody: { flex: 1, gap: spacing.xs },
  timeInput: {
    width: 80,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: MIN_TOUCH,
    fontSize: font.small.size,
    color: colors.textPrimary,
    backgroundColor: colors.inputBg,
  },
  name: { fontSize: font.body.size, fontWeight: '600', color: colors.textStrong },
  deleteText: { fontSize: font.small.size, color: colors.danger, fontWeight: '600', paddingVertical: spacing.xs },
  bar: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelText: { fontSize: font.body.size, color: colors.textPrimary, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveText: { fontSize: font.body.size, color: colors.textOnPrimary, fontWeight: '700' },
});
