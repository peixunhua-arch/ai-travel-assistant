// 首次进入「规划行程」的轻引导弹窗（效果图落地）。
// 只展示一次：AsyncStorage key = hasSeenFirstPlanGuide。
import { useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TripGenerateRequest } from '@travel/shared';
import { colors, spacing, radius, font, shadow } from '../theme';
import { parseTripIntent } from '../lib/parseTripIntent';
import { tapLight } from '../haptics';

export const FIRST_PLAN_GUIDE_KEY = 'hasSeenFirstPlanGuide';

const QUICK_TAGS = [
  { label: '周末短途', prefs: ['轻松'], days: 2, pace: 'relaxed' as const },
  { label: '带爸妈', prefs: ['轻松', '美食'], companions: 'elder' as const, pace: 'relaxed' as const },
  { label: '山水自然', prefs: ['自然'] },
  { label: '人文古迹', prefs: ['人文古迹', '打卡'] },
  { label: '轻松慢游', prefs: ['轻松', '康养慢游'], pace: 'relaxed' as const },
  { label: '朋友结伴', companions: 'friends' as const },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onGenerate: (params: TripGenerateRequest) => void;
}

export async function markFirstPlanGuideSeen(): Promise<void> {
  await AsyncStorage.setItem(FIRST_PLAN_GUIDE_KEY, '1');
}

export async function shouldShowFirstPlanGuide(): Promise<boolean> {
  const v = await AsyncStorage.getItem(FIRST_PLAN_GUIDE_KEY);
  return v !== '1';
}

export function FirstPlanGuide({ visible, onDismiss, onGenerate }: Props) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedMeta = useMemo(() => {
    const prefs = new Set<string>();
    let companions: TripGenerateRequest['companions'];
    let pace: TripGenerateRequest['pace'];
    let days: number | undefined;
    for (const tag of QUICK_TAGS) {
      if (!selected.includes(tag.label)) continue;
      tag.prefs?.forEach((p) => prefs.add(p));
      if (tag.companions) companions = tag.companions;
      if (tag.pace) pace = tag.pace;
      if (tag.days) days = tag.days;
    }
    return { prefs: [...prefs], companions, pace, days };
  }, [selected]);

  const finishDismiss = async () => {
    await markFirstPlanGuideSeen();
    onDismiss();
  };

  const toggleTag = (label: string) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const handleGenerate = async () => {
    const raw = text.trim();
    const parsed = raw ? parseTripIntent(raw) : null;
    const destination = parsed?.destination?.trim() || '';

    if (!destination && !raw) {
      setError('说一句话，或先点几个标签再试');
      return;
    }
    if (!destination) {
      // 有文案但没解析出城市：仍可开规划，把原文塞进补充说明，落到表单让用户补目的地
      setError('还没识别到城市，请写上目的地，如「成都3天」');
      return;
    }

    tapLight();
    const params: TripGenerateRequest = {
      destination,
      days: parsed?.days || selectedMeta.days || 3,
      budget: parsed?.budget ?? 3000,
      preferences: [
        ...new Set([...(parsed?.preferences ?? []), ...selectedMeta.prefs]),
      ],
      companions: selectedMeta.companions ?? parsed?.companions,
      pace: selectedMeta.pace ?? parsed?.pace ?? 'moderate',
      prompt: raw || undefined,
    };
    await markFirstPlanGuideSeen();
    onGenerate(params);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finishDismiss}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={finishDismiss}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={styles.close}
              onPress={finishDismiss}
              accessibilityRole="button"
              accessibilityLabel="关闭引导"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="airplane" size={36} color={colors.primaryDark} />
            </View>

            <Text style={styles.title}>
              想去<Text style={styles.titleAccent}>哪儿</Text>玩？
            </Text>
            <Text style={styles.sub}>别纠结，交给途灵</Text>
            <Text style={styles.sub2}>说一句话，或点几个标签，就帮你出行程。</Text>

            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="例：想去大理发呆 / 成都3天2夜"
              placeholderTextColor={colors.textPlaceholder}
              value={text}
              onChangeText={(t) => {
                setText(t);
                if (error) setError(null);
              }}
              multiline
              maxLength={120}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.tags}>
              {QUICK_TAGS.map((tag) => {
                const on = selected.includes(tag.label);
                return (
                  <TouchableOpacity
                    key={tag.label}
                    style={[styles.tag, on && styles.tagOn]}
                    onPress={() => toggleTag(tag.label)}
                  >
                    <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cta}
              onPress={handleGenerate}
              accessibilityRole="button"
              accessibilityLabel="一键生成AI行程"
            >
              <Ionicons name="sparkles" size={18} color={colors.textOnAccent} />
              <Text style={styles.ctaText}>一键生成 AI 行程</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondary}
              onPress={finishDismiss}
              accessibilityRole="button"
              accessibilityLabel="自己慢慢填表单"
            >
              <Text style={styles.secondaryText}>我自己慢慢填 →</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 36, 28, 0.42)',
    justifyContent: 'center',
  },
  backdropPress: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    ...shadow.soft,
  },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  heroIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: colors.textStrong,
    letterSpacing: 0.5,
  },
  titleAccent: {
    color: colors.accent,
  },
  sub: {
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: font.body.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sub2: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: font.small.size,
    color: colors.textMuted,
    lineHeight: 20,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: font.body.size,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: 6,
    fontSize: 11,
    color: colors.danger,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagOn: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: font.small.size,
    color: colors.textPrimary,
  },
  tagTextOn: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: colors.textOnAccent,
    fontSize: font.body.size,
    fontWeight: '800',
  },
  secondary: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: font.small.size,
    fontWeight: '600',
  },
});
