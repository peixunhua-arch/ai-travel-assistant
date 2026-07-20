// 天气条：横向展示未来几天的「日期 / 天气文字 / 最低~最高温」。
//
// 两个页面共用：
//   - 预览页（preview）：用后端生成行程时顺带返回的 weather；
//   - 详情页（[id]）：用打开时实时拉的最新 weather（旧的会过期，不存本地）。
// 空数组就整块不画（没天气、加载中、失败、离线都归到这一种），延续「不留空占位」原则。
import { View, Text, StyleSheet } from 'react-native';
import type { WeatherDay } from '@travel/shared';
import { colors, spacing, radius, font } from '../theme';

export function WeatherStrip({ days }: { days: WeatherDay[] }) {
  if (days.length === 0) return null;

  return (
    <View style={styles.bar}>
      {days.map((w) => (
        <View key={w.date} style={styles.cell}>
          {/* date 是 "2026-07-11"，slice(5) 取 "07-11" 更紧凑 */}
          <Text style={styles.date}>{w.date.slice(5)}</Text>
          <Text style={styles.text}>{w.textDay}</Text>
          <Text style={styles.temp}>
            {w.tempMin}~{w.tempMax}°
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  date: { fontSize: font.tiny.size, color: colors.textMuted },
  text: { fontSize: font.small.size, color: colors.textStrong, fontWeight: '600' },
  temp: { fontSize: font.tiny.size, color: colors.textPrimary },
});
