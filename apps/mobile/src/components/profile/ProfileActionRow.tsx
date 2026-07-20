// 「我的」页操作行（圆润图标 + 箭头）。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors, spacing, font } from '../../theme';
import { MIN_TOUCH } from '../../lib/a11y';
import { tapLight } from '../../haptics';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon?: IconName;
  label: string;
  hint?: string;
  badge?: string;
  onPress: () => void;
  last?: boolean;
}

export function ProfileActionRow({ icon, label, hint, badge, onPress, last }: Props) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={() => {
        tapLight();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}，${hint}` : label}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.primaryDark} />
        </View>
      ) : null}
      <View style={styles.textCol}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {hint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textPlaceholder} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    minHeight: MIN_TOUCH,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textStrong,
  },
  badge: {
    backgroundColor: colors.accentBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentDark,
  },
  hint: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
});
