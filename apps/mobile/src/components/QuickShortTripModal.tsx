// 快速短途规划弹窗（底部中间「+」入口）：1–2 天周边游一键生成。
import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { TripGenerateRequest } from '@travel/shared';
import { colors, spacing, radius, font, shadow } from '../theme';
import { tapLight } from '../haptics';

const SHORT_CITIES = ['苏州', '杭州', '南京', '乌镇', '古北水镇', '绍兴', '扬州', '天津'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: TripGenerateRequest) => void;
}

export function QuickShortTripModal({ visible, onClose, onSubmit }: Props) {
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState<1 | 2>(2);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const handleGenerate = () => {
    const dest = destination.trim();
    if (!dest) {
      setError('请先输入或选择目的地');
      return;
    }
    tapLight();
    onSubmit({
      destination: dest,
      days,
      budget: 3000,
      preferences: ['轻松', '美食'],
      pace: 'relaxed',
      companions: 'friends',
      prompt: '短途周边游，安排松紧适中',
    });
    setDestination('');
    setDays(2);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>快速短途规划</Text>
            <Text style={styles.sub}>1–2 天周边游，途灵帮你快速出一版路线</Text>

            <Text style={styles.label}>去哪儿</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="输入城市，如：苏州"
              placeholderTextColor={colors.textPlaceholder}
              value={destination}
              onChangeText={(t) => {
                setDestination(t);
                if (error) setError(null);
              }}
              maxLength={40}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.chipRow}>
              {SHORT_CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, destination === c && styles.chipOn]}
                  onPress={() => {
                    setDestination(c);
                    setError(null);
                  }}
                >
                  <Text style={[styles.chipText, destination === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>玩几天</Text>
            <View style={styles.dayRow}>
              {([1, 2] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayChip, days === d && styles.dayChipOn]}
                  onPress={() => setDays(d)}
                >
                  <Text style={[styles.dayText, days === d && styles.dayTextOn]}>{d} 天</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cta} onPress={handleGenerate} accessibilityRole="button">
              <Text style={styles.ctaText}>一键生成短途行程</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} style={styles.cancel}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 36, 28, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  center: { width: '100%' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textStrong,
  },
  sub: {
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: font.tiny.size,
    color: colors.textMuted,
    lineHeight: 18,
  },
  label: {
    fontSize: font.small.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 11, marginTop: 4 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  chipOn: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, color: colors.textPrimary },
  chipTextOn: { color: colors.primaryDark, fontWeight: '700' },
  dayRow: { flexDirection: 'row', gap: spacing.sm },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.bg,
  },
  dayChipOn: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  dayText: { fontSize: font.small.size, color: colors.textPrimary, fontWeight: '600' },
  dayTextOn: { color: colors.primaryDark, fontWeight: '800' },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: colors.textOnAccent, fontSize: font.body.size, fontWeight: '800' },
  cancel: { marginTop: spacing.sm, alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: colors.textMuted, fontSize: font.small.size },
});
