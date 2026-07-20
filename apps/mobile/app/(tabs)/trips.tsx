// 「行程」Tab：搜索 / 筛选 / 排序 / 同步状态 / 卡片菜单 / 空状态引导。
import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import type { SavedTrip } from '@travel/shared';
import {
  listSavedTrips,
  deleteSavedTrip,
  restoreSavedTrip,
  getOptimisticSaving,
  importMissingCloudTrips,
  setDraftTrip,
} from '../../src/tripStore';
import { TripListItem } from '../../src/components/TripListItem';
import { TripListSkeleton } from '../../src/components/TripListSkeleton';
import { SAMPLE_TRIP_ID } from '../../src/sampleTrip';
import { getPinnedIds, togglePinned, sortTripsWithPinned } from '../../src/tripPin';
import { FadeInView } from '../../src/components/FadeInView';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius, shadow } from '../../src/theme';
import { openTripDetail } from '../../src/navigation';
import { tapSuccess, tapError, tapLight } from '../../src/haptics';
import { useNetworkStatus } from '../../src/network';
import { cloneTripParams } from '../../src/tripAdjust';

type SortKey = 'updated' | 'month' | 'budget';
type SyncState = 'idle' | 'syncing' | 'done' | 'error';

const COMPANION_FILTERS: { key: string; label: string }[] = [
  { key: '', label: '全部同行' },
  { key: 'solo', label: '独自' },
  { key: 'couple', label: '情侣' },
  { key: 'family', label: '亲子' },
  { key: 'elder', label: '带老人' },
  { key: 'friends', label: '朋友结伴' },
];

const DAY_FILTERS = [
  { key: 'all', label: '全部天数' },
  { key: 'short', label: '1–2天' },
  { key: 'mid', label: '3–5天' },
  { key: 'long', label: '6天+' },
];

const BUDGET_FILTERS = [
  { key: 'all', label: '全部预算' },
  { key: 'eco', label: '经济' },
  { key: 'comfort', label: '舒适' },
  { key: 'high', label: '高端/不限' },
];

function matchDayFilter(days: number, key: string) {
  if (key === 'short') return days <= 2;
  if (key === 'mid') return days >= 3 && days <= 5;
  if (key === 'long') return days >= 6;
  return true;
}

function matchBudgetFilter(trip: SavedTrip, key: string) {
  const user = trip.insights?.userBudget;
  const ref = user !== undefined ? user : trip.budgetEstimate;
  if (key === 'eco') return ref > 0 && ref <= 4000;
  if (key === 'comfort') return ref > 4000 && ref <= 10000;
  if (key === 'high') return ref === 0 || ref > 10000;
  return true;
}

function sortTrips(list: SavedTrip[], sort: SortKey): SavedTrip[] {
  const arr = [...list];
  if (sort === 'budget') {
    arr.sort((a, b) => (a.budgetEstimate || 0) - (b.budgetEstimate || 0));
  } else if (sort === 'month') {
    arr.sort((a, b) => (a.travelMonth || '～').localeCompare(b.travelMonth || '～', 'zh'));
  } else {
    arr.sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt).getTime();
      return tb - ta;
    });
  }
  return arr;
}

export default function TripsTab() {
  const router = useRouter();
  const network = useNetworkStatus();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncHint, setSyncHint] = useState('');
  const [undoTrip, setUndoTrip] = useState<SavedTrip | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [destFilter, setDestFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [companionFilter, setCompanionFilter] = useState('');

  const load = useCallback(async () => {
    const [all, pinned] = await Promise.all([listSavedTrips(), getPinnedIds()]);
    const optimistic = getOptimisticSaving();
    const merged = optimistic ? [optimistic, ...all.filter((t) => t.id !== optimistic.id)] : all;
    setTrips(sortTripsWithPinned(merged, pinned));
    setPinnedIds(pinned);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const scheduleUndoClear = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoTrip(null), 5000);
  };

  const handleDelete = (trip: SavedTrip) => {
    Alert.alert('删除行程', `确定删除「${trip.destination}」这份行程吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteSavedTrip(trip.id);
          setTrips((prev) => prev.filter((t) => t.id !== trip.id));
          setUndoTrip(trip);
          scheduleUndoClear();
        },
      },
    ]);
  };

  const handleUndo = async () => {
    if (!undoTrip) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await restoreSavedTrip(undoTrip);
    await load();
    setUndoTrip(null);
  };

  const handlePin = async (trip: SavedTrip) => {
    const nowPinned = await togglePinned(trip.id);
    await load();
    Alert.alert('', nowPinned ? '已置顶' : '已取消置顶');
  };

  const handleClone = (trip: SavedTrip) => {
    tapLight();
    setDraftTrip(null, cloneTripParams(trip));
    router.navigate('/(tabs)/');
  };

  const handleRestoreCloud = async () => {
    if (network === 'offline') {
      Alert.alert('需要联网', '从云端恢复行程需要网络连接');
      return;
    }
    setSyncState('syncing');
    setSyncHint('');
    try {
      const n = await importMissingCloudTrips();
      await load();
      tapSuccess();
      setSyncState('done');
      setSyncHint(n > 0 ? `已同步，新增 ${n} 份` : '已自动同步');
      if (syncHintTimer.current) clearTimeout(syncHintTimer.current);
      syncHintTimer.current = setTimeout(() => {
        setSyncState('idle');
        setSyncHint('');
      }, 2800);
    } catch {
      tapError();
      setSyncState('error');
      setSyncHint('同步失败，点此重试');
    }
  };

  const destinations = useMemo(() => {
    const set = new Set(trips.map((t) => t.destination).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
  }, [trips]);

  const activeFilterCount = [
    destFilter,
    dayFilter !== 'all',
    budgetFilter !== 'all',
    companionFilter,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = trips.filter((t) => {
      if (destFilter && t.destination !== destFilter) return false;
      if (!matchDayFilter(t.daysCount, dayFilter)) return false;
      if (!matchBudgetFilter(t, budgetFilter)) return false;
      if (companionFilter && t.insights?.companions !== companionFilter) return false;
      if (!q) return true;
      const budgetStr = String(t.budgetEstimate);
      const month = t.travelMonth ?? '';
      const prefs = (t.insights?.preferenceLabels ?? []).join(' ');
      const hay = `${t.destination} ${budgetStr} ${month} ${prefs} ${t.daysCount}天`.toLowerCase();
      return hay.includes(q);
    });
    list = sortTrips(list, sortKey);
    return sortTripsWithPinned(list, pinnedIds);
  }, [
    trips,
    query,
    destFilter,
    dayFilter,
    budgetFilter,
    companionFilter,
    sortKey,
    pinnedIds,
  ]);

  const sortLabel =
    sortKey === 'budget' ? '预算升序' : sortKey === 'month' ? '出行时间' : '最新更新';

  return (
    <GestureHandlerRootView style={styles.safe}>
      <SafeAreaView style={styles.safeInner} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.headerTitle}>行程</Text>
          </View>
          <View style={styles.headerActions}>
            {trips.length > 0 && (
              <TouchableOpacity
                style={[styles.iconChip, activeFilterCount > 0 && styles.iconChipOn]}
                onPress={() => setFilterOpen(true)}
                accessibilityLabel="筛选行程"
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={activeFilterCount > 0 ? colors.primaryDark : colors.textMuted}
                />
                {activeFilterCount > 0 ? (
                  <Text style={styles.filterCount}>{activeFilterCount}</Text>
                ) : null}
              </TouchableOpacity>
            )}
            {trips.length > 0 && network !== 'offline' && (
              <TouchableOpacity
                style={[
                  styles.syncBtn,
                  syncState === 'error' && styles.syncBtnError,
                  syncState === 'done' && styles.syncBtnDone,
                ]}
                onPress={handleRestoreCloud}
                disabled={syncState === 'syncing'}
              >
                {syncState === 'syncing' ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Ionicons
                    name={syncState === 'error' ? 'refresh' : 'cloud-outline'}
                    size={14}
                    color={syncState === 'error' ? colors.danger : colors.primaryDark}
                  />
                )}
                <Text
                  style={[
                    styles.restoreLink,
                    syncState === 'error' && { color: colors.danger },
                  ]}
                >
                  {syncState === 'syncing'
                    ? '同步中'
                    : syncState === 'error'
                      ? '重试'
                      : syncState === 'done'
                        ? syncHint || '已同步'
                        : '云端同步'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {syncState === 'done' && syncHint ? (
          <Text style={styles.syncToast}>{syncHint}</Text>
        ) : null}
        {syncState === 'error' && syncHint ? (
          <TouchableOpacity onPress={handleRestoreCloud}>
            <Text style={styles.syncError}>{syncHint}</Text>
          </TouchableOpacity>
        ) : null}

        {trips.length > 0 && (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              placeholder="搜索目的地、预算、出行时间…"
              placeholderTextColor={colors.textPlaceholder}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              accessibilityLabel="搜索行程"
            />
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setSortOpen(true)}
              accessibilityLabel="排序"
            >
              <Ionicons name="swap-vertical-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.sortBtnText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>
        )}

        {undoTrip && (
          <View style={styles.undoBar}>
            <Text style={styles.undoText}>已删除「{undoTrip.destination}」</Text>
            <TouchableOpacity onPress={handleUndo}>
              <Text style={styles.undoAction}>撤销</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <TripListSkeleton />
        ) : trips.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="briefcase-outline" size={36} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>你还没有规划任何行程</Text>
            <Text style={styles.emptyDesc}>一键定制专属旅途，从目的地与天数开始</Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push('/(tabs)')}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>去规划行程</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => openTripDetail(router, SAMPLE_TRIP_ID)}
            >
              <Text style={styles.ctaSecondaryText}>查看示例行程</Text>
            </TouchableOpacity>
            {network !== 'offline' && (
              <TouchableOpacity style={styles.ctaSecondary} onPress={handleRestoreCloud}>
                <Text style={styles.ctaSecondaryText}>
                  {syncState === 'syncing' ? '恢复中…' : '从云端恢复'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FadeInView style={styles.flex}>
            <FlatList
              data={filtered}
              keyExtractor={(t) => t.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                <Text style={styles.noMatch}>没有匹配的行程，试试调整筛选或搜索</Text>
              }
              renderItem={({ item }) => (
                <TripListItem
                  trip={item}
                  pinned={pinnedIds.includes(item.id)}
                  saving={item.id.startsWith('saving-')}
                  onPress={() => openTripDetail(router, item.id)}
                  onEdit={() => openTripDetail(router, item.id)}
                  onClone={() => handleClone(item)}
                  onDelete={() => handleDelete(item)}
                  onPin={() => handlePin(item)}
                />
              )}
            />
          </FadeInView>
        )}

        {/* 筛选面板 */}
        <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setFilterOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>筛选行程</Text>

              <Text style={styles.sheetLabel}>目的地</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !destFilter && styles.chipOn]}
                  onPress={() => setDestFilter('')}
                >
                  <Text style={[styles.chipText, !destFilter && styles.chipTextOn]}>全部</Text>
                </TouchableOpacity>
                {destinations.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, destFilter === d && styles.chipOn]}
                    onPress={() => setDestFilter(d)}
                  >
                    <Text style={[styles.chipText, destFilter === d && styles.chipTextOn]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetLabel}>出行天数</Text>
              <View style={styles.chipRow}>
                {DAY_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, dayFilter === f.key && styles.chipOn]}
                    onPress={() => setDayFilter(f.key)}
                  >
                    <Text style={[styles.chipText, dayFilter === f.key && styles.chipTextOn]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetLabel}>预算区间</Text>
              <View style={styles.chipRow}>
                {BUDGET_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.chip, budgetFilter === f.key && styles.chipOn]}
                    onPress={() => setBudgetFilter(f.key)}
                  >
                    <Text style={[styles.chipText, budgetFilter === f.key && styles.chipTextOn]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sheetLabel}>同行人</Text>
              <View style={styles.chipRow}>
                {COMPANION_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key || 'all'}
                    style={[styles.chip, companionFilter === f.key && styles.chipOn]}
                    onPress={() => setCompanionFilter(f.key)}
                  >
                    <Text style={[styles.chipText, companionFilter === f.key && styles.chipTextOn]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetGhost}
                  onPress={() => {
                    setDestFilter('');
                    setDayFilter('all');
                    setBudgetFilter('all');
                    setCompanionFilter('');
                  }}
                >
                  <Text style={styles.sheetGhostText}>重置</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetPrimary} onPress={() => setFilterOpen(false)}>
                  <Text style={styles.sheetPrimaryText}>完成</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* 排序面板 */}
        <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSortOpen(false)}>
            <Pressable style={styles.sortSheet} onPress={(e) => e.stopPropagation()}>
              {(
                [
                  { key: 'updated' as const, label: '最新更新' },
                  { key: 'month' as const, label: '出行日期临近' },
                  { key: 'budget' as const, label: '预算从低到高' },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={styles.sortItem}
                  onPress={() => {
                    setSortKey(opt.key);
                    setSortOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortItemText,
                      sortKey === opt.key && styles.sortItemTextOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {sortKey === opt.key && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeInner: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    ...shadow.soft,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: font.display.size,
    lineHeight: font.display.lineHeight,
    fontWeight: font.display.weight,
    color: colors.textStrong,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.bg,
  },
  iconChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  filterCount: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
    minHeight: 32,
  },
  syncBtnDone: {
    borderColor: colors.primaryDark,
  },
  syncBtnError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  restoreLink: {
    fontSize: font.tiny.size,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  syncToast: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.primaryDark,
    paddingVertical: 4,
    backgroundColor: colors.primaryBg,
  },
  syncError: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.danger,
    paddingVertical: 4,
    textDecorationLine: 'underline',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  search: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm + 2,
    fontSize: font.small.size,
    color: colors.textPrimary,
  },
  sortBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  sortBtnText: {
    fontSize: 10,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.textStrong,
  },
  undoText: { color: colors.textOnPrimary, fontSize: font.small.size },
  undoAction: { color: colors.primary, fontSize: font.small.size, fontWeight: '700' },
  list: { padding: spacing.md, gap: spacing.md },
  noMatch: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: font.body.size,
    paddingVertical: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textStrong,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: font.small.size,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  ctaSecondary: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  ctaSecondaryText: { color: colors.primary, fontSize: font.body.size, fontWeight: '700' },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl * 1.5,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.md,
  },
  ctaText: { color: colors.textOnAccent, fontSize: font.body.size, fontWeight: '800' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(50,36,28,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textStrong,
    marginBottom: spacing.md,
  },
  sheetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  chipOn: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  chipTextOn: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  sheetGhost: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetGhostText: { color: colors.textMuted, fontWeight: '700' },
  sheetPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sheetPrimaryText: { color: colors.textOnPrimary, fontWeight: '800' },
  sortSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  sortItemText: {
    fontSize: font.body.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sortItemTextOn: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
});
