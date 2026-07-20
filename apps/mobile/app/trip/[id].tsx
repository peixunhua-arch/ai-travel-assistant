// 行程「详情页」：本地已保存行程的浏览、编辑、分享、评价（含离线模式）。
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { SavedTrip, WeatherDay, TripReviews, PoiReputation } from '@travel/shared';
import { getSavedTrip, updateSavedTrip, setDraftTrip, cacheTripLocally, resyncSavedTrip } from '../../src/tripStore';
import { SAMPLE_TRIP, SAMPLE_TRIP_ID, isSampleTrip } from '../../src/sampleTrip';
import {
  buildRefinePrompt,
  buildRegeneratePrompt,
  savedTripToParams,
} from '../../src/tripAdjust';
import { fetchWeather, getTripReviews, postReview, fetchPoiReputations } from '../../src/api';
import { DayPlan } from '../../src/components/DayPlan';
import { ResizableTripMap } from '../../src/components/ResizableTripMap';
import { WeatherStrip } from '../../src/components/WeatherStrip';
import { ReviewButtons } from '../../src/components/ReviewButtons';
import { ReviewProgress } from '../../src/components/ReviewProgress';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { GenerationInsightsBanner } from '../../src/components/GenerationInsightsBanner';
import { TripEditor } from '../../src/components/TripEditor';
import { DisclaimerFooter } from '../../src/components/DisclaimerFooter';
import { DayTabBar } from '../../src/components/DayTabBar';
import { ReviewGentleBanner } from '../../src/components/ReviewGentleBanner';
import { TripShareCard } from '../../src/components/TripShareCard';
import { showTripShareOptions } from '../../src/shareTrip';
import { useNetworkStatus } from '../../src/network';
import { safeGoBack } from '../../src/navigation';
import {
  enqueueReview,
  flushReviewQueue,
  getPendingReviewCount,
  getPendingReviewKeys,
} from '../../src/reviewQueue';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapSuccess, tapError } from '../../src/haptics';
import { useElderMode, useThemeColors } from '../../src/lib/elderMode';
import { speakTripDay, stopSpeaking, getSpeaking } from '../../src/lib/tripSpeech';
import { useToast } from '../../src/components/Toast';

export default function TripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const network = useNetworkStatus();
  const isOffline = network === 'offline';
  const { enabled: elderMode } = useElderMode();
  const themeColors = useThemeColors();
  const { showToast } = useToast();

  const [trip, setTrip] = useState<SavedTrip | null | undefined>(undefined);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [reviews, setReviews] = useState<TripReviews | null>(null);
  const [reputations, setReputations] = useState<Record<string, PoiReputation>>({});
  const [pendingReviews, setPendingReviews] = useState(0);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);
  const [showReviewHint, setShowReviewHint] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const shareCardRef = useRef<View>(null);
  const daySectionY = useRef(0);
  const mapOffsets = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!id) return;
    if (id === SAMPLE_TRIP_ID) {
      setTrip(SAMPLE_TRIP);
      setActiveDay(SAMPLE_TRIP.days[0]?.day ?? 1);
      return;
    }
    getSavedTrip(id).then((t) => {
      setTrip(t);
      if (t) {
        setActiveDay(t.days[0]?.day ?? 1);
        cacheTripLocally(t).catch(() => {});
      }
    });
  }, [id]);

  useEffect(() => {
    setSelectedMapIndex(null);
    mapOffsets.current = {};
  }, [activeDay]);

  useEffect(() => {
    if (selectedMapIndex == null) return;
    const y = mapOffsets.current[selectedMapIndex];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  }, [selectedMapIndex]);

  const registerMapOffset = (mapIndex: number, localY: number) => {
    mapOffsets.current[mapIndex] = daySectionY.current + localY;
  };

  const refreshReviews = async () => {
    if (!trip?.serverTripId || isOffline) return;
    const fresh = await getTripReviews(trip.serverTripId);
    setReviews(fresh);
  };

  const refreshPending = useCallback(async () => {
    const count = await getPendingReviewCount();
    setPendingReviews(count);
    if (trip?.serverTripId) {
      setPendingKeys(await getPendingReviewKeys(trip.serverTripId));
    }
  }, [trip?.serverTripId]);

  // 联网后自动同步离线评价队列
  useFocusEffect(
    useCallback(() => {
      refreshPending();
      if (network !== 'offline') {
        flushReviewQueue().then((n) => {
          if (n > 0) refreshReviews();
          refreshPending();
        });
      }
    }, [network, refreshPending]),
  );

  useEffect(() => {
    if (trip && !isOffline) fetchWeather(trip.destination).then(setWeather);
    if (isOffline) setWeather([]);
  }, [trip, isOffline]);

  useEffect(() => {
    if (trip?.serverTripId && !isOffline) getTripReviews(trip.serverTripId).then(setReviews);
  }, [trip, isOffline]);

  useEffect(() => {
    if (!trip || isOffline) return;
    const poiIds = trip.days
      .flatMap((d) => d.items)
      .map((i) => i.poiId)
      .filter((pid): pid is string => !!pid);
    if (poiIds.length === 0) return;
    fetchPoiReputations(poiIds).then(setReputations);
  }, [trip, isOffline]);

  const submitReview = async (
    poiId: string | null,
    sentiment: 1 | -1,
    tags: string[],
    comment?: string,
  ) => {
    if (!trip?.serverTripId) return;

    const input = { tripId: trip.serverTripId, poiId, sentiment, tags, comment };

    if (isOffline) {
      await enqueueReview(input);
      await refreshPending();
      tapSuccess();
      Alert.alert('已保存', '评价将在联网后自动同步');
      return;
    }

    const ok = await postReview(input);
    if (ok) {
      tapSuccess();
      await refreshReviews();
    } else {
      tapError();
      Alert.alert('评价失败', '请检查网络后重试；离线时会自动排队');
    }
  };

  const handleRefine = () => {
    if (!trip || isOffline) {
      Alert.alert('', isOffline ? '调整行程需要联网' : '行程不存在');
      return;
    }
    setDraftTrip(null, savedTripToParams(trip, buildRefinePrompt(trip)));
    router.push({ pathname: '/trip/preview', params: { replaceId: trip.id } });
  };

  const handleRegenerate = () => {
    if (!trip || isOffline) {
      Alert.alert('', isOffline ? '重新生成需要联网' : '行程不存在');
      return;
    }
    setDraftTrip(null, savedTripToParams(trip, buildRegeneratePrompt(trip)));
    router.push({ pathname: '/trip/preview', params: { replaceId: trip.id } });
  };

  const handleShare = () => {
    if (!trip) return;
    showTripShareOptions(trip, shareCardRef);
  };

  const handleShareToCommunity = () => {
    if (!trip || isSampleTrip(trip.id)) return;
    if (!trip.serverTripId) {
      Alert.alert(
        '暂不能分享',
        '该行程尚未同步到云端。请先点「重新上传」，成功后再分享到社区。',
      );
      return;
    }
    router.push({
      pathname: '/community/create',
      params: { type: 'trip', tripId: trip.id },
    });
  };

  const handleResync = async () => {
    if (!trip || isOffline || isSampleTrip(trip.id) || trip.serverTripId) return;
    setResyncing(true);
    try {
      const ok = await resyncSavedTrip(trip.id);
      if (ok) {
        const fresh = await getSavedTrip(trip.id);
        if (fresh) setTrip(fresh);
        tapSuccess();
        Alert.alert('同步成功', '行程已上传到云端，现在可以评价或分享到社区了');
      } else {
        tapError();
        Alert.alert('同步失败', '请检查网络后重试');
      }
    } finally {
      setResyncing(false);
    }
  };

  const handleReadAloud = async () => {
    if (!trip || !activeDayData) return;
    const talking = await getSpeaking();
    if (talking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    await speakTripDay(activeDayData, trip.destination, { rate: elderMode ? 0.82 : 0.92 });
    setSpeaking(true);
    showToast(`正在朗读第 ${activeDay} 天安排`);
    setTimeout(async () => {
      if (!(await getSpeaking())) setSpeaking(false);
    }, 3000);
  };

  useEffect(() => () => stopSpeaking(), []);

  const handleSaveEdit = async (updated: SavedTrip) => {
    await updateSavedTrip(updated);
    setTrip(updated);
    setEditing(false);
    tapSuccess();
    Alert.alert('', '行程已更新');
  };

  const handleBack = () => {
    if (editing) {
      Alert.alert('放弃修改？', '未保存的编辑将丢失', [
        { text: '继续编辑', style: 'cancel' },
        { text: '放弃', style: 'destructive', onPress: () => setEditing(false) },
      ]);
      return;
    }
    safeGoBack(router, '/(tabs)/trips');
  };

  const reviewablePois = trip
    ? trip.days.flatMap((d) => d.items).filter((i) => i.poiId && i.type !== 'transport')
    : [];
  const reviewedCount = reviews
    ? reviewablePois.filter((i) => i.poiId && reviews.poiReviews[i.poiId]).length
    : 0;

  const canReview = !!trip?.serverTripId && !isOffline && !isSampleTrip(trip?.id ?? '');
  const activeDayData = trip?.days.find((d) => d.day === activeDay) ?? trip?.days[0];
  const activeDayItems = activeDayData?.items ?? [];

  useEffect(() => {
    if (!canReview || reviews?.tripReview) return;
    const timer = setTimeout(() => setShowReviewHint(true), 8000);
    return () => clearTimeout(timer);
  }, [canReview, reviews?.tripReview]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 100) {
      if (canReview && !reviews?.tripReview) setShowReviewHint(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="返回">
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {trip ? trip.destination : '行程详情'}
        </Text>
        <View style={styles.headerActions}>
          {trip && !editing && (
            <TouchableOpacity
              onPress={handleReadAloud}
              accessibilityLabel={speaking ? '停止朗读' : '读给我听'}
            >
              <Text style={styles.headerAction}>{speaking ? '停止' : '朗读'}</Text>
            </TouchableOpacity>
          )}
          {trip && !editing && !isSampleTrip(trip.id) && (
            <>
              <TouchableOpacity onPress={handleShareToCommunity} accessibilityLabel="分享到社区">
                <Text style={styles.headerAction}>社区</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} accessibilityLabel="分享行程">
                <Text style={styles.headerAction}>分享</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(true)} accessibilityLabel="编辑行程">
                <Text style={styles.headerAction}>编辑</Text>
              </TouchableOpacity>
            </>
          )}
          {trip && isSampleTrip(trip.id) && (
            <Text style={styles.sampleTag}>示例</Text>
          )}
        </View>
      </View>

      {isOffline && <OfflineBanner pendingReviews={pendingReviews} />}

      {trip === null ? (
        <View style={styles.center}>
          <Text style={styles.notFound}>行程不存在或已被删除</Text>
        </View>
      ) : trip ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          {editing ? (
            <TripEditor
              trip={trip}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryMeta}>
                  {trip.daysCount} 天 ·{' '}
                  {trip.budgetEstimate > 0 ? `预算约 ${trip.budgetEstimate} 元` : '预算不限'}
                </Text>
                {!isOffline && !isSampleTrip(trip.id) && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleRefine}>
                      <Text style={styles.actionBtnText}>在此基础上调整</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleRegenerate}>
                      <Text style={styles.actionBtnText}>重新生成</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {trip.insights ? (
                <GenerationInsightsBanner
                  insights={trip.insights}
                  budgetEstimate={trip.budgetEstimate}
                />
              ) : null}

              <WeatherStrip days={weather} />

              <ResizableTripMap
                items={activeDayItems}
                offline={isOffline}
                selectedIndex={selectedMapIndex}
                onSelectIndex={setSelectedMapIndex}
              />

              {trip.serverTripId && reviewablePois.length > 0 && (
                <ReviewProgress done={reviewedCount} total={reviewablePois.length} />
              )}

              <DayTabBar
                days={trip.days.map((d) => d.day)}
                activeDay={activeDay}
                onSelect={setActiveDay}
              />

              <ReviewGentleBanner
                visible={showReviewHint && canReview && !reviews?.tripReview}
                onDismiss={() => setShowReviewHint(false)}
              />

              <View
                style={styles.days}
                onLayout={(e) => {
                  daySectionY.current = e.nativeEvent.layout.y;
                }}
              >
                {trip.days
                  .filter((d) => d.day === activeDay || trip.days.length === 1)
                  .map((d) => (
                  <DayPlan
                    key={d.day}
                    day={d}
                    poiReviews={reviews?.poiReviews}
                    reputations={reputations}
                    onPoiReview={
                      canReview
                        ? (poiId, s, tags, c) => submitReview(poiId, s, tags, c)
                        : undefined
                    }
                    canReview={canReview}
                    collapsible
                    highlightedMapIndex={d.day === activeDay ? selectedMapIndex : null}
                    budgetPerDay={
                      trip.budgetEstimate > 0 ? trip.budgetEstimate / trip.daysCount : undefined
                    }
                    onSelectMapIndex={setSelectedMapIndex}
                    onRegisterMapOffset={registerMapOffset}
                    pendingPoiIds={pendingKeys}
                  />
                ))}
              </View>

              {trip.serverTripId ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>这趟行程怎么样？</Text>
                  <ReviewButtons
                    current={reviews?.tripReview ?? null}
                    onSubmit={(s, tags, c) => submitReview(null, s, tags, c)}
                    disabled={!canReview}
                    pendingSync={pendingKeys.has('__trip__')}
                  />
                  {isOffline && (
                    <Text style={styles.offlineHint}>离线时可提交，联网后自动同步</Text>
                  )}
                </View>
              ) : (
                <View style={styles.notSyncedBox}>
                  <Text style={styles.notSynced}>此行程未同步到云端，暂不能评价或分享社区</Text>
                  {!isOffline && !isSampleTrip(trip.id) && (
                    <TouchableOpacity
                      style={[styles.resyncBtn, resyncing && styles.resyncBtnDisabled]}
                      onPress={handleResync}
                      disabled={resyncing}
                      accessibilityRole="button"
                      accessibilityLabel="重新上传到云端"
                    >
                      <Text style={styles.resyncBtnText}>
                        {resyncing ? '上传中…' : '重新上传'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <DisclaimerFooter />
            </>
          )}
        </ScrollView>
      ) : null}

      {trip && !editing && (
        <View style={styles.offscreen} pointerEvents="none">
          <TripShareCard ref={shareCardRef} trip={trip} />
        </View>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: font.title.size,
    fontWeight: font.title.weight,
    color: colors.textStrong,
    marginHorizontal: spacing.sm,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm, minWidth: 120, justifyContent: 'flex-end', flexWrap: 'wrap' },
  headerAction: { fontSize: font.small.size, color: colors.primary, fontWeight: '600' },
  sampleTag: { fontSize: font.tiny.size, color: colors.textMuted, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  notFound: { fontSize: font.body.size, color: colors.textMuted },

  content: { padding: spacing.md, gap: spacing.md },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryMeta: { fontSize: font.small.size, color: colors.textMuted },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  actionBtnText: { fontSize: font.small.size, color: colors.primary, fontWeight: '600' },
  days: { gap: spacing.md },

  reviewBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  reviewTitle: { fontSize: font.body.size, fontWeight: '600', color: colors.textStrong },
  offlineHint: { fontSize: font.tiny.size, color: colors.textMuted },
  notSynced: {
    fontSize: font.small.size,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notSyncedBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  resyncBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  resyncBtnDisabled: { opacity: 0.6 },
  resyncBtnText: {
    color: colors.textOnPrimary,
    fontSize: font.small.size,
    fontWeight: '700',
  },
  offscreen: {
    position: 'absolute',
    left: -2000,
    top: 0,
    opacity: 0,
  },
});
