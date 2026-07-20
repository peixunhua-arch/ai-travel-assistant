// 「我的」页设置行：场景化说明 + 开启时对勾反馈。
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '../../theme';
import { MIN_TOUCH } from '../../lib/a11y';
import { tapLight } from '../../haptics';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel?: string;
  last?: boolean;
}

export function ProfileSwitchRow({
  label,
  hint,
  value,
  onValueChange,
  accessibilityLabel,
  last,
}: Props) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.check} />
      ) : null}
      <Switch
        value={value}
        onValueChange={(v) => {
          tapLight();
          onValueChange(v);
        }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
        accessibilityLabel={accessibilityLabel ?? (hint ? `${label}，${hint}` : label)}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  textCol: { flex: 1, gap: 2 },
  label: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textStrong,
  },
  hint: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  check: { marginRight: -2 },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});
