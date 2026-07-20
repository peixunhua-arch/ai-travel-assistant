// 「生成中」状态：按天数逐步点亮「第 N 天已就绪」，细节阶段用进度条动画，避免空转圈等待。
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, shadow } from '../theme';

type StepStatus = 'pending' | 'active' | 'done';

interface StepItem {
  key: string;
  label: string;
  kind: 'prep' | 'day' | 'detail';
  day?: number;
}

const DETAIL_LINES = [
  '正在衔接日间通勤…',
  '正在核对开放时间…',
  '正在搭配餐饮节奏…',
  '正在微调游览顺序…',
  '正在估算花费区间…',
];

const PREP_MS = 2200;
const WEATHER_MS = 4500;
/** 每一天「就绪」动画间隔基准（随后按总数略压缩） */
const DAY_BASE_MS = 4200;
const DETAIL_TICK_MS = 2800;
const SLOW_HINT_MS = 28000;
const TIMEOUT_MS = 70000;

function buildSteps(daysCount: number, destination: string): StepItem[] {
  const days = Math.max(1, Math.min(14, daysCount || 3));
  const dest = destination.trim() || '目的地';
  const steps: StepItem[] = [
    { key: 'prep', label: `正在理解「${dest}」出行需求…`, kind: 'prep' },
    { key: 'poi', label: '正在查询天气与真实地点…', kind: 'prep' },
  ];
  for (let d = 1; d <= days; d++) {
    steps.push({
      key: `day-${d}`,
      label: `第 ${d} 天行程已就绪`,
      kind: 'day',
      day: d,
    });
  }
  steps.push({ key: 'detail', label: '正在优化行程细节…', kind: 'detail' });
  return steps;
}

function StepRow({
  label,
  status,
  kind,
}: {
  label: string;
  status: StepStatus;
  kind: StepItem['kind'];
}) {
  const scale = useRef(new Animated.Value(status === 'done' ? 1 : 0.6)).current;
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (status === 'done') {
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [status, scale]);

  useEffect(() => {
    if (status !== 'active') {
      pulse.stopAnimation();
      pulse.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const icon =
    status === 'done' ? (
      <Animated.View style={[styles.checkWrap, { transform: [{ scale }] }]}>
        <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
      </Animated.View>
    ) : status === 'active' ? (
      <Animated.View style={[styles.dotActiveWrap, { opacity: pulse }]}>
        <View style={styles.dotActiveInner} />
      </Animated.View>
    ) : (
      <View style={styles.dotPending} />
    );

  return (
    <View style={[styles.stepRow, status === 'done' && styles.stepRowDone]}>
      {icon}
      <Text
        style={[
          styles.stepLabel,
          status === 'active' && styles.stepLabelActive,
          status === 'done' && styles.stepLabelDone,
          status === 'pending' && styles.stepLabelPending,
        ]}
        numberOfLines={1}
      >
        {status === 'active' && kind === 'day' ? label.replace('已就绪', '排程中…') : label}
      </Text>
      {status === 'done' && kind === 'day' ? (
        <Text style={styles.readyBadge}>就绪</Text>
      ) : null}
    </View>
  );
}

export function GenerateProgress({
  onCancel,
  daysCount = 3,
  destination = '',
}: {
  onCancel: () => void;
  daysCount?: number;
  destination?: string;
}) {
  const steps = useMemo(
    () => buildSteps(daysCount, destination),
    [daysCount, destination],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailLine, setDetailLine] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const timeoutShownRef = useRef(false);
  const bar = useRef(new Animated.Value(0.08)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();
    setActiveIndex(0);
    setDetailLine(0);
    timeoutShownRef.current = false;

    const daySteps = steps.filter((s) => s.kind === 'day').length;
    // 天数越多略压缩每步，避免用户感觉「越走越慢」
    const dayGap = Math.max(2600, DAY_BASE_MS - Math.max(0, daySteps - 3) * 350);

    const schedule = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
    };

    let elapsed = 0;
    schedule(PREP_MS, () => setActiveIndex(1));
    elapsed = PREP_MS;
    schedule(elapsed + WEATHER_MS, () => setActiveIndex(2));
    elapsed += WEATHER_MS;
    for (let i = 0; i < daySteps; i++) {
      const targetIndex = 2 + i;
      schedule(elapsed + dayGap * (i + 1), () => {
        setActiveIndex(Math.min(targetIndex + 1, steps.length - 1));
      });
    }
    elapsed += dayGap * daySteps;

    DETAIL_LINES.forEach((_, i) => {
      schedule(elapsed + DETAIL_TICK_MS * (i + 1), () => setDetailLine(i));
    });

    schedule(SLOW_HINT_MS, () => setShowSlowHint(true));
    schedule(TIMEOUT_MS, () => {
      if (timeoutShownRef.current) return;
      timeoutShownRef.current = true;
      Alert.alert('生成时间较长', '是否继续等待？途灵仍在优化细节', [
        { text: '取消', style: 'destructive', onPress: onCancel },
        { text: '继续等待', style: 'cancel' },
      ]);
    });

    return clearTimers;
  }, [steps, onCancel]);

  // 进度条：跟 activeIndex 与细节文案联动推进，末段缓慢蠕动而不是卡死
  useEffect(() => {
    const prepCount = 2;
    const dayCount = steps.filter((s) => s.kind === 'day').length;
    const total = prepCount + dayCount + 1;
    let ratio = Math.min(0.92, (activeIndex + 0.35) / total);
    if (activeIndex >= steps.length - 1) {
      ratio = Math.min(0.96, 0.78 + detailLine * 0.035);
    }
    Animated.timing(bar, {
      toValue: ratio,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeIndex, detailLine, steps, bar]);

  // 末段缓慢「呼吸」推进，避免进度条完全静止
  useEffect(() => {
    if (activeIndex < steps.length - 1) return;
    const id = setInterval(() => {
      bar.stopAnimation((v) => {
        const next = Math.min(0.98, (typeof v === 'number' ? v : 0.9) + 0.008);
        Animated.timing(bar, {
          toValue: next,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start();
      });
    }, 1200);
    return () => clearInterval(id);
  }, [activeIndex, steps.length, bar]);

  const doneDays = Math.max(0, Math.min(daysCount, activeIndex - 2));
  const onDetail = activeIndex >= steps.length - 1;
  const barWidth = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>途灵正在定制行程</Text>
      <Text style={styles.subtitle}>
        {destination ? `${destination} · ` : ''}
        {daysCount} 天
        {doneDays > 0 ? ` · 已就绪 ${Math.min(doneDays, daysCount)}/${daysCount} 天` : ''}
      </Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      <View style={[styles.card, shadow.soft]}>
        {steps.map((step, i) => {
          let status: StepStatus = 'pending';
          if (i < activeIndex) status = 'done';
          else if (i === activeIndex) status = 'active';
          // 当天步骤：active 时显示「排程中」，下一 tick 变 done
          return (
            <StepRow key={step.key} label={step.label} status={status} kind={step.kind} />
          );
        })}

        {onDetail && (
          <View style={styles.detailBox}>
            <View style={styles.detailHeader}>
              <Ionicons name="color-wand-outline" size={16} color={colors.accentDark} />
              <Text style={styles.detailTitle}>细节优化中</Text>
            </View>
            <Text style={styles.detailLine}>{DETAIL_LINES[detailLine]}</Text>
            <View style={styles.detailSegRow}>
              {DETAIL_LINES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.detailSeg, i <= detailLine && styles.detailSegOn]}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {showSlowHint && (
        <Text style={styles.slowHint}>
          多日行程需要核对真实地点，通常还要一会；已完成的天数不会丢失
        </Text>
      )}

      <TouchableOpacity
        style={styles.cancel}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="取消生成"
      >
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textStrong,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.small.size,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  stepRowDone: {
    opacity: 1,
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  dotActiveWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryBg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActiveInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  stepLabel: {
    flex: 1,
    fontSize: font.small.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  stepLabelDone: {
    color: colors.textStrong,
  },
  stepLabelPending: {
    color: colors.textPlaceholder,
    fontWeight: '500',
  },
  readyBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  detailBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailTitle: {
    fontSize: font.small.size,
    fontWeight: '800',
    color: colors.accentDark,
  },
  detailLine: {
    fontSize: font.tiny.size,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  detailSegRow: {
    flexDirection: 'row',
    gap: 4,
  },
  detailSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentLight,
  },
  detailSegOn: {
    backgroundColor: colors.accent,
  },
  slowHint: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: 'auto',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: font.body.size,
    color: colors.textMuted,
  },
});
