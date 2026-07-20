// 加减步进器：[-] 3 天 [+]。用于表单里选「天数」。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';

interface Props {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  unit?: string;
}

export function Stepper({ value, min = 1, max = 14, onChange, unit }: Props) {
  const canDec = value > min;
  const canInc = value < max;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, !canDec && styles.btnDisabled]}
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        accessibilityRole="button"
        accessibilityLabel="减少"
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>

      <Text style={styles.value} allowFontScaling accessibilityLabel={`当前 ${value}${unit ?? ''}`}>
        {value}
        {unit ? ` ${unit}` : ''}
      </Text>

      <TouchableOpacity
        style={[styles.btn, !canInc && styles.btnDisabled]}
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        accessibilityRole="button"
        accessibilityLabel="增加"
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  btn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 22,
    color: colors.primaryDark,
    lineHeight: 26,
    fontWeight: '600',
  },
  value: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
  },
});
