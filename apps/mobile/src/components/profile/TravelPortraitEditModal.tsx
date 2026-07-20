// 编辑旅行画像偏好 / 结伴习惯。
import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { TravelPortrait } from '../../lib/travelPortrait';
import {
  PREFERENCE_CHIP_OPTIONS,
  COMPANION_CHIP_OPTIONS,
} from '../../lib/travelPortrait';
import { colors, spacing, radius, font } from '../../theme';
import { tapLight, tapSuccess } from '../../haptics';

interface Props {
  visible: boolean;
  portrait: TravelPortrait;
  onClose: () => void;
  onSave: (next: TravelPortrait) => Promise<void>;
}

export function TravelPortraitEditModal({
  visible,
  portrait,
  onClose,
  onSave,
}: Props) {
  const [prefs, setPrefs] = useState(portrait.preferences);
  const [companions, setCompanions] = useState(portrait.companions);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPrefs(portrait.preferences);
    setCompanions(portrait.companions);
  }, [visible, portrait]);

  const togglePref = (p: string) => {
    tapLight();
    setPrefs((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...portrait, preferences: prefs, companions });
    setSaving(false);
    tapSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>编辑旅行偏好</Text>
          <Text style={styles.sub}>保存后，规划行程时会自动预填这些标签</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <Text style={styles.label}>兴趣偏好</Text>
            <View style={styles.chips}>
              {PREFERENCE_CHIP_OPTIONS.map((p) => {
                const on = prefs.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => togglePref(p)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>出行人群</Text>
            <View style={styles.chips}>
              {COMPANION_CHIP_OPTIONS.map((c) => {
                const on = companions === c.value;
                return (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => {
                      tapLight();
                      setCompanions(on ? undefined : c.value);
                    }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.save, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(60,40,30,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '82%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textStrong,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  scroll: { maxHeight: 360 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  chipOn: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: font.small.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextOn: { color: colors.primaryDark, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  cancelText: { fontWeight: '700', color: colors.textMuted },
  save: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveText: { fontWeight: '800', color: colors.textOnPrimary },
});
