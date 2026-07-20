// §16.2 能力发现：让用户知道 AI 能做什么、不能做什么。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

const CAN_DO = [
  '查签证、天气、美食攻略',
  '按表单规划多日行程',
  '保存行程、点赞评价影响推荐',
];
const CANNOT_DO = ['订票付款', '实时导航', '保证信息 100% 准确'];

export function CapabilityHint() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>我能帮你做什么</Text>
      {CAN_DO.map((item) => (
        <Text key={item} style={styles.can}>
          ✓ {item}
        </Text>
      ))}
      <Text style={styles.subtitle}>暂时不能</Text>
      {CANNOT_DO.map((item) => (
        <Text key={item} style={styles.cannot}>
          · {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  title: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  can: {
    fontSize: font.small.size,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  cannot: {
    fontSize: font.small.size,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
