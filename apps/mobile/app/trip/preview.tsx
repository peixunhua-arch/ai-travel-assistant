// 行程「预览页」。是个盖在底部 Tab 之上的 Stack 页（文件放在 app/trip/ 下，Expo Router 自动注册）。
//
// 它负责整条「生成→看→存」的主流程，四种状态：
//   loading  —— 正在生成（显示 GenerateProgress 轮播 + 取消）
//   success  —— 生成好了（顶部摘要 + 按天卡片 + 底部操作栏：保存 / 重新生成 / 修改需求）
//   error    —— 生成失败（错误文案 + 重新生成 / 修改需求）
//
// 需求从哪来？从 tripStore 的「草稿」里读（表单页跳转前已 setDraftTrip(null, params)）。
// 生成成功后把结果也写回草稿（setDraftTrip(result, params)），这样「修改需求」返回表单能回填。
//
// 「未保存」拦截：生成成功但还没点保存时，用户想返回/改需求，先弹确认，避免辛苦生成的结果被误丢。
import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { TripGenerateResponse } from '@travel/shared';
import { generateTrip, checkHealth } from '../../src/api';
import { getApiBaseUrl } from '../../src/apiBase';
import { getDraftTrip, setDraftTrip, clearDraftTrip, saveTrip, findSimilarTrip, savePreviewDraft, clearPreviewDraft, replaceSavedTrip, setOptimisticSaving } from '../../src/tripStore';
import { DayPlan } from '../../src/components/DayPlan';
import { ResizableTripMap } from '../../src/components/ResizableTripMap';
import { WeatherStrip } from '../../src/components/WeatherStrip';
import { GenerateProgress } from '../../src/components/GenerateProgress';
import { DisclaimerFooter } from '../../src/components/DisclaimerFooter';
import { HealthBanner } from '../../src/components/HealthBanner';
import { GenerationInsightsBanner } from '../../src/components/GenerationInsightsBanner';
import { DayTabBar } from '../../src/components/DayTabBar';
import { TripShareCard } from '../../src/components/TripShareCard';
import { showTripShareOptions } from '../../src/shareTrip';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapSuccess, tapError } from '../../src/haptics';
import type { TripWarnings } from '@travel/shared';
import type { SavedTrip } from '@travel/shared';
import { notifyTripReady } from '../../src/notifications';
import { useToast } from '../../src/components/Toast';
import { buildRegenerateDayPrompt } from '../../src/tripAdjust';
import { safeGoBack } from '../../src/navigation';

type Status = 'loading' | 'success' | 'error';

export default function TripPreview() {
  const router = useRouter();
  const { replaceId } = useLocalSearchParams<{ replaceId?: string }>();
  const { showToast } = useToast();

  const [status, setStatus] = useState<Status>('loading');
  const [trip, setTrip] = useState<TripGenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  // 生成成功但还没保存 = true。用于返回/改需求前的确认拦截。
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [personalizedHint, setPersonalizedHint] = useState(false);
  const [warnings, setWarnings] = useState<TripWarnings | undefined>();
  const [activeDay, setActiveDay] = useState(1);
  const [bgNotice, setBgNotice] = useState(false);
  // 存当前请求的 AbortController，取消/离开时中止它。
  const abortRef = useRef<AbortController | null>(null);
  const wasBackgroundRef = useRef(false);
  const shareCardRef = useRef<View>(null);

  // 发起一次生成。重新生成也调它。
  const doGenerate = async () => {
    const draft = getDraftTrip();
    // 理论上不会发生（都是从表单带着草稿进来的），保险起见兜一下。
    if (!draft) {
      setStatus('error');
      setErrorMsg('缺少行程需求，请返回重新填写');
      return;
    }

    setStatus('loading');
    setWarnings(undefined);
    setBgNotice(false);
    const controller = new AbortController();
    abortRef.current = controller;

    const healthy = await checkHealth();
    if (!healthy) {
      setStatus('error');
      setErrorMsg(
        `无法连接后端 ${getApiBaseUrl()}\n\n请确认电脑后端已启动，手机与电脑同一 WiFi；或到「我的」页修改服务器地址。`,
      );
      return;
    }

    try {
      const result = await generateTrip(draft.params, controller.signal);
      setDraftTrip(result, draft.params); // 把结果写回草稿，供「修改需求」回填
      setTrip(result);
      setWarnings(result.warnings);
      setActiveDay(result.days[0]?.day ?? 1);
      setStatus('success');
      setHasUnsaved(true);
      setPersonalizedHint(!!result.personalized);
      if (result.personalized) {
        showToast('已根据你的历史偏好调整本次推荐');
      }
      savePreviewDraft(result, draft.params);
      tapSuccess();
      if (AppState.currentState !== 'active') {
        notifyTripReady(result.destination);
      }
    } catch (e) {
      // 用户主动取消（AbortController.abort）会抛 AbortError——那是预期内的，忽略，不显示报错。
      if ((e as Error)?.name === 'AbortError') return;
      setStatus('error');
      setErrorMsg((e as Error)?.message || '生成失败，请重试');
      tapError();
    }
  };

  // 挂载即生成；卸载时中止未完成的请求（防止在已卸载组件上 setState 报警告）。
  useEffect(() => {
    doGenerate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §6.6 切后台回前台：生成期间切走、完成后回前台时轻提示
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (status === 'loading') wasBackgroundRef.current = true;
      }
      if (next === 'active' && wasBackgroundRef.current && status === 'success' && trip) {
        setBgNotice(true);
        notifyTripReady(trip.destination);
        wasBackgroundRef.current = false;
      }
    });
    return () => sub.remove();
  }, [status, trip]);

  // 保存：写入本地 → 触觉成功 → 清草稿 → 跳到「行程」Tab（replace，别让用户点返回又回到预览）。
  const doSave = async () => {
    if (!trip) return;
    await finishSave('new');
  };

  const finishSave = async (mode: 'new' | 'replace') => {
    if (!trip) return;

    const draftParams = getDraftTrip()?.params;
    const travelMonth = draftParams?.travelMonth;
    const meta = {
      travelMonth,
      params: draftParams ?? undefined,
    };

    const runPersist = async (): Promise<SavedTrip> => {
      if (mode === 'replace' && replaceId) {
        return replaceSavedTrip(replaceId, trip, meta);
      }
      return saveTrip(trip, meta);
    };

    if (mode === 'new' || !replaceId) {
      const optimistic: SavedTrip = {
        id: `saving-${Date.now()}`,
        createdAt: new Date().toISOString(),
        destination: trip.destination,
        daysCount: trip.daysCount,
        budgetEstimate: trip.budgetEstimate,
        days: trip.days,
      };
      setOptimisticSaving(optimistic);
      setHasUnsaved(false);
      clearDraftTrip();
      await clearPreviewDraft();
      try {
        const saved = await runPersist();
        setOptimisticSaving(null);
        tapSuccess();
        router.replace(`/trip/${saved.id}`);
      } catch {
        setOptimisticSaving(null);
        router.replace('/(tabs)/trips');
        Alert.alert('保存失败', '请返回行程列表重试');
      }
      return;
    }

    try {
      const saved = await runPersist();
      tapSuccess();
      setHasUnsaved(false);
      clearDraftTrip();
      await clearPreviewDraft();
      router.replace(`/trip/${saved.id}`);
    } catch {
      Alert.alert('保存失败', '请稍后重试');
    }
  };

  const handleSave = async () => {
    if (!trip) return;

    if (replaceId) {
      Alert.alert('保存方式', '要如何保存这份新行程？', [
        { text: '取消', style: 'cancel' },
        { text: '另存为新行程', onPress: () => finishSave('new') },
        { text: '覆盖原行程', onPress: () => finishSave('replace') },
      ]);
      return;
    }

    const similar = await findSimilarTrip(trip.destination, trip.daysCount);
    if (similar) {
      Alert.alert(
        '已有类似行程',
        `你已保存过「${similar.destination}」${similar.daysCount} 天的行程，仍要保存吗？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '仍要保存', onPress: () => doSave() },
        ],
      );
      return;
    }
    await doSave();
  };

  const handleShare = () => {
    if (!trip) return;
    showTripShareOptions(trip, shareCardRef);
  };

  // 带「未保存」确认的返回：有未保存结果先问一句。
  const confirmLeave = (onLeave: () => void) => {
    if (!hasUnsaved) {
      onLeave();
      return;
    }
    Alert.alert('行程还没保存', '离开将丢失这次生成的行程，确定吗？', [
      { text: '取消', style: 'cancel' },
      { text: '离开', style: 'destructive', onPress: onLeave },
    ]);
  };

  // 顶部「← 返回」：回上一页（表单）；无历史时落到规划 Tab。
  const leaveToPlan = () => safeGoBack(router, '/(tabs)');
  const handleBack = () => confirmLeave(leaveToPlan);
  // 「修改需求」：同样回表单页（草稿里已有 params，表单会回填）。
  const handleEdit = () => confirmLeave(leaveToPlan);

  const handleRegenerateDay = (dayNum: number) => {
    const draft = getDraftTrip();
    if (!draft || !trip) return;
    const prompt = buildRegenerateDayPrompt(trip, dayNum);
    setDraftTrip(trip, { ...draft.params, prompt });
    doGenerate();
  };

  // 预算对比（轻提示）：拿「用户填的预算」跟「模型估算」比，估算更高就温柔提醒一句。
  //   用户预算从草稿 params 里取（budget===0 表示「不限」，此时不提示）。
  //   为什么只在预览页做？——SavedTrip 里没存用户原始预算（只存了 budgetEstimate），
  //   详情页拿不到用户预算，没法比。所以这只是「生成当下」的提示，不改存储、不进详情页。
  const userBudget = getDraftTrip()?.params.budget ?? 0;
  const overBudget = trip !== null && userBudget > 0 && trip.budgetEstimate > userBudget;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 顶栏：自定义返回按钮（比监听系统返回对初学者更直观），走未保存确认。 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="返回">
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>行程预览</Text>
        {status === 'success' && trip ? (
          <TouchableOpacity onPress={handleShare} accessibilityLabel="分享行程">
            <Text style={styles.shareBtn}>分享</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <HealthBanner />

      {status === 'loading' && (
        <GenerateProgress
          daysCount={getDraftTrip()?.params.days ?? 3}
          destination={getDraftTrip()?.params.destination ?? ''}
          onCancel={() => {
            abortRef.current?.abort();
            safeGoBack(router, '/(tabs)');
          }}
        />
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={doGenerate}>
              <Text style={styles.primaryBtnText}>重新生成</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleEdit}>
              <Text style={styles.secondaryBtnText}>修改需求</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'success' && trip && (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {/* 摘要条 */}
            <View style={styles.summary}>
              <Text style={styles.summaryDest}>{trip.destination}</Text>
              <Text style={styles.summaryMeta}>
                {trip.daysCount} 天 ·{' '}
                {trip.budgetEstimate > 0 ? `预算约 ${trip.budgetEstimate} 元` : '预算不限'}
              </Text>
              {/* 预算轻提示：估算超过用户填写的预算时才出现（黄字，不吓人、不拦截保存）。 */}
              {overBudget && (
                <Text style={styles.budgetWarn}>
                  预估约 {trip.budgetEstimate} 元，可能略超你设的 {userBudget} 元预算
                </Text>
              )}
            </View>

            {personalizedHint && (
              <View style={styles.personalizedBanner}>
                <Text style={styles.personalizedText}>
                  ✨ 已根据你的历史偏好调整本次推荐
                </Text>
              </View>
            )}

            {bgNotice && (
              <View style={styles.personalizedBanner}>
                <Text style={styles.personalizedText}>行程已生成好，可以查看并保存</Text>
              </View>
            )}

            <GenerationInsightsBanner
              personalized={personalizedHint}
              warnings={warnings}
              preferenceLabels={getDraftTrip()?.params.preferences}
              usedWeather={Array.isArray(trip.weather) && trip.weather.length > 0}
              userBudget={getDraftTrip()?.params.budget}
              budgetEstimate={trip.budgetEstimate}
            />

            {/* 天气条：生成行程时后端顺带返回的预报（模型调了 get_weather 才有）。
                详情页则是打开时实时另拉一份（旧预报会过期）——两处共用 WeatherStrip 组件。 */}
            <WeatherStrip days={trip.weather ?? []} />

            {/* 地图：所有天的 items 拍平；无坐标点或无 JS key 时 TripMap 自动不显示。 */}
            <ResizableTripMap items={trip.days.flatMap((d) => d.items)} offline={false} />

            <DayTabBar
              days={trip.days.map((d) => d.day)}
              activeDay={activeDay}
              onSelect={setActiveDay}
            />

            {/* 按天卡片 */}
            <View style={styles.days}>
              {trip.days
                .filter((d) => d.day === activeDay || trip.days.length === 1)
                .map((d) => (
                  <DayPlan
                    key={d.day}
                    day={d}
                    collapsible
                    isSparse={warnings?.sparseDays.includes(d.day)}
                    isFailed={trip.failedDays?.includes(d.day)}
                    onRegenerateDay={
                      warnings?.sparseDays.includes(d.day) || trip.failedDays?.includes(d.day)
                        ? () => handleRegenerateDay(d.day)
                        : undefined
                    }
                  />
                ))}
            </View>

            <DisclaimerFooter />
          </ScrollView>

          <View style={styles.offscreen} pointerEvents="none">
            <TripShareCard ref={shareCardRef} trip={trip} />
          </View>

          {/* 底部固定操作栏 */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
              <Text style={styles.primaryBtnText}>保存行程</Text>
            </TouchableOpacity>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={doGenerate}>
                <Text style={styles.secondaryBtnText}>重新生成</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleEdit}>
                <Text style={styles.secondaryBtnText}>修改需求</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.accentBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  back: { fontSize: font.body.size, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: font.title.size, fontWeight: font.title.weight, color: colors.textStrong },
  headerRight: { width: 56 },
  shareBtn: { fontSize: font.small.size, color: colors.primary, fontWeight: '600', minWidth: 56, textAlign: 'right' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorEmoji: { fontSize: 48 },
  errorText: {
    fontSize: font.body.size,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorActions: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    gap: spacing.md,
  },

  content: { padding: spacing.md, gap: spacing.md },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryDest: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.xs,
  },
  summaryMeta: { fontSize: font.small.size, color: colors.textMuted },
  budgetWarn: {
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    color: colors.warningText,
    marginTop: spacing.xs,
  },
  personalizedBanner: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  personalizedText: {
    fontSize: font.small.size,
    color: colors.primaryDark,
    fontWeight: '600',
    textAlign: 'center',
  },
  days: { gap: spacing.md },

  actionBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.textOnPrimary, fontSize: font.body.size, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnText: { color: colors.textPrimary, fontSize: font.body.size, fontWeight: '600' },
  offscreen: {
    position: 'absolute',
    left: -2000,
    top: 0,
    opacity: 0,
  },
});
