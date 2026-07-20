// §5.2 可拖拽调整地图高度：上下拖动把手改变 TripMap 显示区域。
import { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import type { TripItem } from '@travel/shared';
import { TripMap } from './TripMap';
import { colors, spacing, radius, font } from '../theme';

const MIN_H = 140;
const MAX_H = 420;
const DEFAULT_H = 260;

export function ResizableTripMap({
  items,
  offline,
  selectedIndex = null,
  onSelectIndex,
}: {
  items: TripItem[];
  offline?: boolean;
  selectedIndex?: number | null;
  onSelectIndex?: (index: number) => void;
}) {
  const [height, setHeight] = useState(DEFAULT_H);
  const startH = useRef(DEFAULT_H);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          startH.current = height;
        },
        onPanResponderMove: (_, g) => {
          const next = Math.round(Math.min(MAX_H, Math.max(MIN_H, startH.current + g.dy)));
          setHeight(next);
        },
      }),
    [height],
  );

  return (
    <View style={styles.wrap}>
      <TripMap
        items={items}
        offline={offline}
        height={height}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
      />
      <View style={styles.handle} {...pan.panHandlers} accessibilityLabel="拖动调整地图高度">
        <View style={styles.grabber} />
        <Text style={styles.handleHint}>拖动调整地图大小</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 36,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  handleHint: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
});
