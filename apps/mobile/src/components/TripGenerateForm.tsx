// 「生成行程」表单（优化版）：分组目的地、天数快捷段、自定义预算、已选汇总、悬浮生成按钮。
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TripGenerateRequest } from '@travel/shared';
import { Stepper } from './Stepper';
import { colors, spacing, radius, font, shadow } from '../theme';
import { useElderMode, useScaledFont } from '../lib/elderMode';
import { loadRecentDestinations, pushRecentDestination } from '../recentDestinations';
import { loadTravelPortrait } from '../lib/travelPortrait';

const CITY_GROUPS: { key: string; title: string; cities: string[] }[] = [
  { key: 'short', title: '短途周边', cities: ['苏州', '杭州', '南京', '乌镇', '扬州', '绍兴'] },
  { key: 'hot', title: '网红热门', cities: ['成都', '重庆', '厦门', '上海', '长沙', '大理'] },
  { key: 'nature', title: '山水自然', cities: ['桂林', '张家界', '黄山', '丽江', '三亚', '青海湖'] },
  { key: 'culture', title: '古城人文', cities: ['西安', '北京', '洛阳', '平遥', '敦煌', '景德镇'] },
];

const DAY_HINTS: Record<string, string> = {
  西安: '西安推荐游玩 4 天，覆盖古迹与美食',
  成都: '成都推荐游玩 3–4 天，兼顾火锅与周边',
  重庆: '重庆推荐游玩 3 天，市区+轻徒步节奏佳',
  北京: '北京推荐游玩 4–5 天，经典景点较分散',
  上海: '上海推荐游玩 2–3 天，适合都市轻旅行',
  杭州: '杭州推荐游玩 2–3 天，西湖与周边悠闲',
  大理: '大理推荐游玩 3–4 天，古城与苍洱线',
  厦门: '厦门推荐游玩 3 天，鼓浪屿+小吃友好',
};

const BUDGET_OPTIONS = [
  { label: '经济', value: 3000, hint: '平价民宿 + 本地小吃 + 公共交通' },
  { label: '舒适', value: 8000, hint: '连锁酒店 + 特色餐厅 + 适量打车' },
  { label: '不限', value: 0, hint: '按体验优先安排，预算弹性更大' },
  { label: '自定义', value: -1, hint: '填写你的人均或总预算（元）' },
];

const PREFERENCE_OPTIONS = [
  '美食',
  '自然',
  '亲子',
  '轻松',
  '打卡',
  '购物',
  '康养慢游',
  '人文古迹',
  '徒步爬山',
  '夜景',
  '本地人多',
];

const MONTH_OPTIONS = ['下月', '暑假', '国庆', '春节', '不限'];
const COMPANION_OPTIONS: { label: string; value: NonNullable<TripGenerateRequest['companions']> }[] = [
  { label: '独自', value: 'solo' },
  { label: '情侣', value: 'couple' },
  { label: '亲子', value: 'family' },
  { label: '带老人', value: 'elder' },
  { label: '朋友结伴', value: 'friends' },
];
const PACE_OPTIONS: { label: string; value: NonNullable<TripGenerateRequest['pace']>; hint: string }[] = [
  { label: '懒人慢节奏', value: 'relaxed', hint: '少赶路，适合带老人与轻旅行' },
  { label: '均衡打卡', value: 'moderate', hint: '经典景点与休息兼顾' },
  { label: '紧凑深度游', value: 'packed', hint: '行程满，适合体力好、时间紧' },
];

const DAY_PRESETS = [
  { label: '1–2天短途', days: 2 },
  { label: '3–5天常规', days: 4 },
  { label: '6天+长线', days: 7 },
];

interface Props {
  initialValues?: TripGenerateRequest;
  onSubmit: (params: TripGenerateRequest) => void;
  disabled?: boolean;
}

export function TripGenerateForm({ initialValues, onSubmit, disabled }: Props) {
  const { enabled: elder } = useElderMode();
  const sf = useScaledFont();
  const [destination, setDestination] = useState(initialValues?.destination ?? '');
  const [days, setDays] = useState(initialValues?.days ?? 3);
  const [budgetMode, setBudgetMode] = useState<'preset' | 'custom'>(() => {
    const b = initialValues?.budget;
    if (b === undefined || b === 3000 || b === 8000 || b === 0) return 'preset';
    return 'custom';
  });
  const [budget, setBudget] = useState(initialValues?.budget ?? 3000);
  const [customBudgetText, setCustomBudgetText] = useState(
    initialValues?.budget && ![0, 3000, 8000].includes(initialValues.budget)
      ? String(initialValues.budget)
      : '',
  );
  const [preferences, setPreferences] = useState<string[]>(initialValues?.preferences ?? []);
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [travelMonth, setTravelMonth] = useState(initialValues?.travelMonth ?? '');
  const [companions, setCompanions] = useState<TripGenerateRequest['companions']>(
    initialValues?.companions,
  );
  const [pace, setPace] = useState<TripGenerateRequest['pace']>(initialValues?.pace);
  const [departureCity, setDepartureCity] = useState(initialValues?.departureCity ?? '');
  const [destError, setDestError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [cityGroup, setCityGroup] = useState(CITY_GROUPS[1].key);
  const [locateOpen, setLocateOpen] = useState(false);
  const [locateDraft, setLocateDraft] = useState('');
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  // 渐进式展开：默认收起高级选项（预算/偏好/节奏等），新用户只看到「去哪儿+玩几天」。
  // 带 initialValues 进来（聊天转行程/复刻同款/微调）且有高级字段 → 自动展开，让用户能看到回填的选项。
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (
      initialValues?.preferences?.length ||
      initialValues?.companions ||
      initialValues?.pace ||
      initialValues?.travelMonth ||
      initialValues?.departureCity
    )
      return true;
    return false;
  });

  useEffect(() => {
    loadRecentDestinations().then(setRecent);
  }, []);

  // 旅行画像：规划页无初始偏好时自动预填（减少重复勾选）
  useEffect(() => {
    if (initialValues?.preferences?.length || initialValues?.companions) return;
    loadTravelPortrait().then((por) => {
      if (por.preferences.length) {
        setPreferences((prev) => (prev.length ? prev : por.preferences));
      }
      if (por.companions) {
        setCompanions((prev) => prev ?? por.companions);
      }
      if (por.nicheRecommend) {
        setPreferences((prev) =>
          prev.includes('本地人多') ? prev : [...prev, '本地人多'],
        );
      }
    });
  }, [initialValues?.preferences, initialValues?.companions]);

  const dayHint = useMemo(() => {
    const key = Object.keys(DAY_HINTS).find((k) => destination.includes(k));
    return key ? DAY_HINTS[key] : destination.trim() ? '天数可按兴趣微调，途灵会按节奏排程' : '';
  }, [destination]);

  const budgetHint = useMemo(() => {
    if (budgetMode === 'custom') return BUDGET_OPTIONS.find((o) => o.value === -1)?.hint;
    return BUDGET_OPTIONS.find((o) => o.value === budget)?.hint;
  }, [budget, budgetMode]);

  const selectedSummary = useMemo(() => {
    const bits: string[] = [];
    if (preferences.length) bits.push(preferences.join('+'));
    const companionLabel = COMPANION_OPTIONS.find((c) => c.value === companions)?.label;
    if (companionLabel) bits.push(companionLabel);
    const paceLabel = PACE_OPTIONS.find((p) => p.value === pace)?.label;
    if (paceLabel) bits.push(paceLabel);
    if (travelMonth) bits.push(travelMonth);
    return bits;
  }, [preferences, companions, pace, travelMonth]);

  const canSubmit = destination.trim().length > 0 && !disabled;

  const applyDestination = (city: string) => {
    setDestination(city);
    if (destError) setDestError(null);
  };

  const togglePreference = (p: string) => {
    setPreferences((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const setCompanionsSmart = (value: TripGenerateRequest['companions'] | undefined) => {
    setCompanions(value);
    if (value === 'elder') {
      setPreferences((prev) => {
        const next = new Set(prev);
        next.add('轻松');
        next.add('美食');
        return [...next];
      });
      setPace('relaxed');
    }
  };

  const resolveBudget = (): number => {
    if (elder) return 0;
    if (budgetMode === 'custom') {
      const n = parseInt(customBudgetText.replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > 0 ? n : 3000;
    }
    return budget;
  };

  const handleSubmit = async () => {
    const dest = destination.trim();
    if (!dest) {
      setDestError('请先输入目的地');
      return;
    }
    setDestError(null);
    await pushRecentDestination(dest);
    setRecent(await loadRecentDestinations());
    onSubmit({
      destination: dest,
      days,
      budget: resolveBudget(),
      preferences: elder ? [] : preferences,
      prompt: elder ? undefined : prompt.trim() || undefined,
      travelMonth: elder ? undefined : travelMonth.trim() || undefined,
      companions: elder ? undefined : companions,
      pace: elder ? 'relaxed' : pace,
      departureCity: elder ? undefined : departureCity.trim() || undefined,
    });
  };

  const activeCities = CITY_GROUPS.find((g) => g.key === cityGroup)?.cities ?? [];

  const aiSuggestCities = useMemo(() => {
    const season = travelMonth === '国庆' || travelMonth === '春节' ? 'crowd' : 'normal';
    if (season === 'crowd') {
      return [
        { city: '景德镇', tip: '国庆相对友好的人文小城' },
        { city: '扬州', tip: '短途慢节奏，人流一般可控' },
        { city: '敦煌', tip: '偏远但仍有空间，建议错峰入园' },
      ];
    }
    return [
      { city: '成都', tip: '热门综合目的地，美食友好' },
      { city: '西安', tip: '当季古迹游，建议 4 天' },
      { city: '杭州', tip: '短途自然+人文平衡' },
    ];
  }, [travelMonth]);

  return (
    <View style={styles.root}>
      {(selectedSummary.length > 0 || travelMonth === '国庆') && !elder && (
        <View style={styles.summaryBar}>
          {selectedSummary.length > 0 ? (
            <Text style={styles.summaryText} numberOfLines={2}>
              已选：{selectedSummary.join(' · ')}
            </Text>
          ) : null}
          {travelMonth === '国庆' || travelMonth === '春节' ? (
            <Text style={styles.warnText} numberOfLines={2}>
              {travelMonth}热门目的地人流偏高，可点搜索框旁 AI 看小众替代
            </Text>
          ) : null}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={[styles.label, { fontSize: sf.body.size }]}>去哪儿</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput, destError && styles.inputError]}
              placeholder="输入城市，或点右侧看 AI 推荐"
              placeholderTextColor={colors.textPlaceholder}
              value={destination}
              onChangeText={(t) => {
                setDestination(t);
                if (destError) setDestError(null);
              }}
              editable={!disabled}
              maxLength={100}
            />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setAiSuggestOpen(true)}
              accessibilityLabel="AI 目的地推荐"
              disabled={disabled}
            >
              <Ionicons name="sparkles-outline" size={18} color={colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setLocateDraft(departureCity);
                setLocateOpen(true);
              }}
              accessibilityLabel="设置出发城市并看周边"
              disabled={disabled}
            >
              <Ionicons name="locate-outline" size={20} color={colors.primaryDark} />
            </TouchableOpacity>
          </View>
          {destError && <Text style={styles.errorText}>{destError}</Text>}

          {recent.length > 0 && (
            <>
              <Text style={styles.subLabel}>我的常去</Text>
              <View style={styles.chipRow}>
                {recent.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, destination === c && styles.chipActive]}
                    onPress={() => applyDestination(c)}
                    disabled={disabled}
                  >
                    <Text style={[styles.chipText, destination === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.groupTabs}>
            {CITY_GROUPS.map((g) => (
              <TouchableOpacity
                key={g.key}
                style={[styles.groupTab, cityGroup === g.key && styles.groupTabOn]}
                onPress={() => setCityGroup(g.key)}
              >
                <Text style={[styles.groupTabText, cityGroup === g.key && styles.groupTabTextOn]}>
                  {g.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chipRow}>
            {activeCities.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, destination === c && styles.chipActive]}
                onPress={() => applyDestination(c)}
                disabled={disabled}
              >
                <Text style={[styles.chipText, destination === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.label, { fontSize: sf.body.size }]}>玩几天</Text>
          <View style={styles.chipRow}>
            {DAY_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[styles.chip, days === p.days && styles.chipActive]}
                onPress={() => setDays(p.days)}
                disabled={disabled}
              >
                <Text style={[styles.chipText, days === p.days && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.stepperWrap}>
            <Stepper value={days} min={1} max={14} onChange={setDays} unit="天" />
          </View>
          {!!dayHint && <Text style={styles.aiHint}>{dayHint}</Text>}
        </View>

        {elder && (
          <Text style={styles.elderHint}>长辈模式：其余选项使用默认设置（预算不限、轻松节奏）</Text>
        )}

        {!elder && (
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showAdvanced ? '收起高级选项' : '展开高级选项'}
          >
            <Text style={styles.advancedToggleText}>
              {showAdvanced ? '收起选项' : '更多选项（预算 · 偏好 · 节奏等）'}
            </Text>
            <Ionicons
              name={showAdvanced ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.primaryDark}
            />
          </TouchableOpacity>
        )}

        {!elder && showAdvanced && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>预算</Text>
              <View style={styles.chipRow}>
                {BUDGET_OPTIONS.map((opt) => {
                  const active =
                    opt.value === -1 ? budgetMode === 'custom' : budgetMode === 'preset' && budget === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.chipSoft, active && styles.chipSoftActive]}
                      onPress={() => {
                        if (opt.value === -1) setBudgetMode('custom');
                        else {
                          setBudgetMode('preset');
                          setBudget(opt.value);
                        }
                      }}
                      disabled={disabled}
                    >
                      <Text style={[styles.chipTextSoft, active && styles.chipTextSoftActive]}>
                        {opt.label}
                        {opt.value > 0 ? ` · ${opt.value}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {budgetMode === 'custom' && (
                <TextInput
                  style={styles.input}
                  placeholder="自定义预算（元），如 5000"
                  placeholderTextColor={colors.textPlaceholder}
                  keyboardType="number-pad"
                  value={customBudgetText}
                  onChangeText={setCustomBudgetText}
                  editable={!disabled}
                  maxLength={8}
                />
              )}
              {!!budgetHint && <Text style={styles.aiHint}>{budgetHint}</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>偏好（可多选）</Text>
              <View style={styles.chipRow}>
                {PREFERENCE_OPTIONS.map((p) => {
                  const active = preferences.includes(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => togglePreference(p)}
                      disabled={disabled}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>出行时间（可选）</Text>
              <View style={styles.chipRow}>
                {MONTH_OPTIONS.map((m) => {
                  const active = travelMonth === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setTravelMonth(active ? '' : m)}
                      disabled={disabled}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>同行人（可选）</Text>
              <View style={styles.chipRow}>
                {COMPANION_OPTIONS.map((opt) => {
                  const active = companions === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCompanionsSmart(active ? undefined : opt.value)}
                      disabled={disabled}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>行程节奏</Text>
              <View style={styles.chipRow}>
                {PACE_OPTIONS.map((opt) => {
                  const active = pace === opt.value;
                  const recommend = companions === 'elder' && opt.value === 'relaxed';
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.paceChip,
                        active && styles.chipActive,
                        recommend && !active && styles.paceRecommend,
                      ]}
                      onPress={() => setPace(active ? undefined : opt.value)}
                      disabled={disabled}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                        {recommend ? ' · 推荐' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {pace ? (
                <Text style={styles.aiHint}>{PACE_OPTIONS.find((p) => p.value === pace)?.hint}</Text>
              ) : companions === 'elder' ? (
                <Text style={styles.aiHint}>已识别「带老人」，建议选择「懒人慢节奏」</Text>
              ) : null}

              <Text style={styles.label}>从哪出发（可选）</Text>
              <TextInput
                style={styles.input}
                placeholder="如：上海（影响大交通和首日安排）"
                placeholderTextColor={colors.textPlaceholder}
                value={departureCity}
                onChangeText={setDepartureCity}
                editable={!disabled}
                maxLength={50}
              />

              <Text style={styles.label}>补充说明（可选）</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="还有什么特别要求？如：想吃火锅、不爬山…"
                placeholderTextColor={colors.textPlaceholder}
                value={prompt}
                onChangeText={setPrompt}
                editable={!disabled}
                maxLength={200}
                multiline
              />
            </View>
          </>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>途灵 AI 将为你定制专属路线</Text>
        <TouchableOpacity
          style={[styles.submit, !canSubmit && styles.submitDisabled, elder && styles.submitElder]}
          onPress={() => {
            if (!destination.trim()) {
              setDestError('请先输入目的地');
              Alert.alert('', '请先输入目的地');
              return;
            }
            handleSubmit();
          }}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="一键生成AI行程"
        >
          <Text style={[styles.submitText, elder && { fontSize: sf.body.size + 2 }]}>
            一键生成 AI 行程
          </Text>
        </TouchableOpacity>
      </View>

      {/* 定位 / 出发城市 */}
      <Modal visible={locateOpen} transparent animationType="fade" onRequestClose={() => setLocateOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLocateOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>你在哪座城市？</Text>
            <Text style={styles.modalSub}>用于出发地与周边短途推荐（无需开启系统定位）</Text>
            <TextInput
              style={styles.input}
              placeholder="如：上海"
              placeholderTextColor={colors.textPlaceholder}
              value={locateDraft}
              onChangeText={setLocateDraft}
              autoFocus
            />
            <TouchableOpacity
              style={styles.modalCta}
              onPress={() => {
                const city = locateDraft.trim();
                if (!city) {
                  Alert.alert('', '请输入城市');
                  return;
                }
                setDepartureCity(city);
                setCityGroup('short');
                setLocateOpen(false);
              }}
            >
              <Text style={styles.modalCtaText}>确认并查看短途周边</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI 目的地建议 */}
      <Modal visible={aiSuggestOpen} transparent animationType="fade" onRequestClose={() => setAiSuggestOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAiSuggestOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>途灵推荐</Text>
            <Text style={styles.modalSub}>
              {travelMonth === '国庆' || travelMonth === '春节'
                ? `${travelMonth}期间热门城市较拥挤，可参考这些替代目的地`
                : '结合时令与热度的轻量推荐，点选即可填入'}
            </Text>
            {aiSuggestCities.map((item) => (
              <TouchableOpacity
                key={item.city}
                style={styles.suggestRow}
                onPress={() => {
                  applyDestination(item.city);
                  setAiSuggestOpen(false);
                }}
              >
                <Text style={styles.suggestCity}>{item.city}</Text>
                <Text style={styles.suggestTip}>{item.tip}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  summaryBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    gap: 4,
  },
  summaryText: {
    fontSize: font.tiny.size,
    color: colors.primaryDark,
    fontWeight: '700',
    lineHeight: 18,
  },
  warnText: {
    fontSize: 11,
    color: colors.warningText,
    lineHeight: 16,
  },
  scroll: { flex: 1 },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    gap: spacing.sm,
    ...shadow.soft,
  },
  label: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  inputError: {
    borderColor: colors.danger,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: font.tiny.size,
  },
  groupTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  groupTabOn: {
    backgroundColor: colors.primaryBg,
  },
  groupTabText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  groupTabTextOn: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: font.tiny.size,
  },
  chipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  chipSoft: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLight,
  },
  chipSoftActive: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  chipTextSoft: {
    color: colors.accentDark,
    fontSize: font.tiny.size,
    fontWeight: '600',
  },
  chipTextSoftActive: {
    color: colors.accentDark,
    fontWeight: '800',
  },
  paceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  paceRecommend: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  stepperWrap: {
    marginTop: 4,
  },
  aiHint: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  elderHint: {
    fontSize: font.small.size,
    color: colors.textMuted,
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  advancedToggleText: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    ...shadow.float,
    gap: 6,
  },
  footerHint: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: colors.primaryDisabled,
    opacity: 0.85,
  },
  submitElder: {
    paddingVertical: spacing.lg,
    minHeight: 56,
  },
  submitText: {
    color: colors.textOnAccent,
    fontSize: font.body.size,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(50,36,28,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.soft,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textStrong,
  },
  modalSub: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  modalCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCtaText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  suggestRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  suggestCity: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  suggestTip: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
