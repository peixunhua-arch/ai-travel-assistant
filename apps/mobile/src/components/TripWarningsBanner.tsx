// §6.3 行程数据质量透明提示：未回填 POI、某天安排过少时顶部黄条说明。
import { View, Text, StyleSheet } from 'react-native';
import type { TripWarnings } from '@travel/shared';
import { colors, spacing, radius, font } from '../theme';

export function TripWarningsBanner({ warnings }: { warnings: TripWarnings }) {
  const lines: string[] = [];
  if (warnings.unenrichedCount > 0) {
    lines.push(
      `有 ${warnings.unenrichedCount} 个地点因信息不全未加入地图（仍可查看文字安排）`,
    );
  }
  if (warnings.sparseDays.length > 0) {
    lines.push(
      `第 ${warnings.sparseDays.join('、')} 天安排较少，可重新生成试试`,
    );
  }
  if (lines.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>⚠️ 部分地点信息不完整</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.body}>
          · {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warningText,
    gap: spacing.xs,
  },
  title: {
    fontSize: font.small.size,
    fontWeight: '700',
    color: colors.warningText,
  },
  body: {
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
    color: colors.warningText,
  },
});
