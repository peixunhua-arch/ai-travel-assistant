// §16.2 能力发现（聊天顶栏折叠版）
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

const CAN_DO = ['查签证/天气/美食', '规划多日行程', '保存并评价影响推荐'];
const CANNOT_DO = ['订票付款', '实时导航'];

export function CapabilityHintCompact() {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="我能帮你做什么，点按展开或收起"
      >
        <Text style={styles.headerText}>💡 我能帮你做什么</Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.body}>
          {CAN_DO.map((item) => (
            <Text key={item} style={styles.can}>
              ✓ {item}
            </Text>
          ))}
          <Text style={styles.sub}>暂时不能：{CANNOT_DO.join('、')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  headerText: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textStrong,
  },
  chevron: { fontSize: 10, color: colors.textMuted },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  can: {
    fontSize: font.tiny.size,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: spacing.xs,
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
});
