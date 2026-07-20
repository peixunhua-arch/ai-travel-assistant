// §5.4 时间选择器（非自由文本）
import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, spacing, radius, font } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';

function parseTime(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 9, m || 0, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function TimePickerField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const date = parseTime(value);

  const onPick = (_: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (picked) onChange(formatTime(picked));
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? `选择时间，当前 ${value}`}
      >
        <Text style={styles.text}>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPick}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  text: { fontSize: font.small.size, color: colors.textPrimary, fontWeight: '600' },
});
