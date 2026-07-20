// 「我的」Tab：旅行名片首屏 + 画像主角 + 工具宫格；设置折叠下沉。
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import type { SavedTrip, UserPreferences, UserProfile } from '@travel/shared';
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  setApiBaseUrl,
  resetApiBaseUrl,
} from '../../src/apiBase';
import { checkHealth, fetchUserPreferences, fetchUserProfile, updateUserProfile } from '../../src/api';
import { listSavedTrips, importMissingCloudTrips } from '../../src/tripStore';
import { ProfileSection } from '../../src/components/profile/ProfileSection';
import { ProfileSwitchRow } from '../../src/components/profile/ProfileSwitchRow';
import { ProfileActionRow } from '../../src/components/profile/ProfileActionRow';
import { ProfileAccordionItem } from '../../src/components/profile/ProfileAccordionItem';
import { ProfileEditModal } from '../../src/components/profile/ProfileEditModal';
import { TravelPortraitCard } from '../../src/components/profile/TravelPortraitCard';
import { TravelPortraitEditModal } from '../../src/components/profile/TravelPortraitEditModal';
import { AnnualReportModal } from '../../src/components/profile/AnnualReportModal';
import { ProfileToolGrid } from '../../src/components/profile/ProfileToolGrid';
import { UserAvatar } from '../../src/components/UserAvatar';
import { DEFAULT_PROFILE } from '../../src/lib/userProfile';
import {
  loadTravelPortrait,
  saveTravelPortrait,
  loadSignature,
  saveSignature,
  computeTravelStats,
  inferCompanionFromTrips,
  companionLabel,
  type TravelPortrait,
  type TravelStats,
} from '../../src/lib/travelPortrait';
import { useElderMode } from '../../src/lib/elderMode';
import { isProactiveEnabled, setProactiveEnabled } from '../../src/proactiveAssistant';
import { useAppTheme } from '../../src/lib/themeMode';
import { isSoundEnabled, setSoundEnabled } from '../../src/feedbackSettings';
import { colors, spacing, font, radius, shadow } from '../../src/theme';
import { useNetworkStatus } from '../../src/network';
import { tapSuccess, tapError, tapLight } from '../../src/haptics';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

function InfoText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.infoText}>{children}</Text>;
}

function soon(title: string, detail: string) {
  Alert.alert(title, detail);
}

export default function ProfileTab() {
  const router = useRouter();
  const network = useNetworkStatus();
  const { colors: themeColors, mode: themeMode, setMode: setThemeMode } = useAppTheme();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [stats, setStats] = useState<TravelStats>({
    tripCount: 0,
    cityCount: 0,
    totalDays: 0,
    reviewCount: 0,
  });
  const { enabled: elderMode, setEnabled: setElderMode } = useElderMode();
  const [proactiveOn, setProactiveOn] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [signature, setSignature] = useState('');
  const [portrait, setPortrait] = useState<TravelPortrait>({
    preferences: [],
    nicheRecommend: false,
    cloudAutoSync: true,
    personalizationAuth: true,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [portraitEditOpen, setPortraitEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState<'privacy' | 'terms' | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [apiDraft, setApiDraft] = useState(getApiBaseUrl());
  const [apiTesting, setApiTesting] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setApiDraft(getApiBaseUrl());
      Promise.all([
        fetchUserPreferences(),
        listSavedTrips(),
        isProactiveEnabled(),
        isSoundEnabled(),
        fetchUserProfile(),
        loadSignature(),
        loadTravelPortrait(),
      ]).then(([p, t, proactive, sound, profile, sig, por]) => {
        setPrefs(p);
        setTrips(t);
        setStats(computeTravelStats(t, p?.reviewCount ?? 0));
        setProactiveOn(proactive);
        setSoundOn(sound);
        if (profile) setUserProfile(profile);
        setSignature(sig);
        setPortrait(por);
      });
    }, []),
  );

  const handleSaveProfile = async (next: UserProfile, nextSig: string) => {
    const saved = await updateUserProfile(next);
    if (!saved) return false;
    setUserProfile(saved);
    await saveSignature(nextSig);
    setSignature(nextSig);
    return true;
  };

  const patchPortrait = async (next: TravelPortrait) => {
    setPortrait(next);
    await saveTravelPortrait(next);
  };

  const handleExport = () => {
    Alert.alert('导出行程文件备份', '选择导出方式', [
      {
        text: '通用备份文件',
        onPress: async () => {
          const list = await listSavedTrips();
          if (list.length === 0) {
            Alert.alert('', '还没有可导出的行程');
            return;
          }
          try {
            await Share.share({
              message: `途灵行程备份（请妥善保管）\n\n${JSON.stringify(list, null, 2)}`,
              title: '途灵-行程文件备份',
            });
            tapSuccess();
          } catch {
            // 取消
          }
        },
      },
      {
        text: '图片 / PDF',
        onPress: () =>
          soon('即将支持', '图片长图与 PDF 导出正在准备中，可先用「通用备份文件」。'),
      },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const handleRestoreCloud = async () => {
    if (network === 'offline') {
      Alert.alert('需要联网', '从云端恢复行程需要网络连接');
      return;
    }
    setRestoring(true);
    try {
      const n = await importMissingCloudTrips();
      const list = await listSavedTrips();
      setTrips(list);
      setStats(computeTravelStats(list, prefs?.reviewCount ?? 0));
      if (n > 0) {
        tapSuccess();
        Alert.alert('恢复成功', `已从云端导入 ${n} 份行程`, [
          { text: '去查看', onPress: () => router.push('/(tabs)/trips') },
          { text: '好的' },
        ]);
      } else {
        Alert.alert('', '云端没有可导入的新行程');
      }
    } catch {
      tapError();
      Alert.alert('恢复失败', '请检查网络与后端后重试');
    } finally {
      setRestoring(false);
    }
  };

  const inferredCompanion = companionLabel(inferCompanionFromTrips(trips));

  const toolItems = [
    {
      key: 'luggage',
      label: '行李清单',
      icon: 'checkbox-outline' as const,
      tint: colors.primaryBg,
      iconColor: colors.primaryDark,
      onPress: () => router.push('/profile/luggage'),
    },
    {
      key: 'docs',
      label: '证件备忘',
      icon: 'card-outline' as const,
      tint: colors.accentBg,
      iconColor: colors.accentDark,
      onPress: () => router.push('/profile/documents'),
    },
    {
      key: 'buddy',
      label: '我的结伴',
      icon: 'people-outline' as const,
      tint: '#EDE6F7',
      iconColor: '#6B5B95',
      onPress: () =>
        soon('结伴空间', '可与朋友、情侣共享行程并协同编辑。先去社区发现同路人吧！'),
    },
    {
      key: 'fav',
      label: '社区收藏',
      icon: 'bookmark-outline' as const,
      tint: '#E3F0FA',
      iconColor: '#3D6F96',
      onPress: () =>
        router.push({ pathname: '/(tabs)/community', params: { tab: 'favorites' } }),
    },
    {
      key: 'help',
      label: '客服帮助',
      icon: 'headset-outline' as const,
      tint: '#E8F3E4',
      iconColor: '#4F8A4A',
      onPress: () => router.push('/profile/help'),
    },
    {
      key: 'feedback',
      label: '意见反馈',
      icon: 'chatbox-ellipses-outline' as const,
      tint: '#FCE8E8',
      iconColor: '#B85A5A',
      onPress: () => router.push('/profile/help'),
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* —— 首屏：旅行名片 —— */}
        <View style={styles.heroBlock}>
          <View style={styles.heroWash} pointerEvents="none">
            <View style={styles.washTeal} />
            <View style={styles.washPeach} />
          </View>
          <TouchableOpacity
            style={styles.hero}
            onPress={() => setEditOpen(true)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="编辑资料"
          >
            <View style={styles.avatarGlow}>
              <UserAvatar avatar={userProfile.avatar} size={72} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {userProfile.displayName}
              </Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                {signature.trim() || '写下你的旅行态度吧'}
              </Text>
            </View>
            <View style={styles.editPill}>
              <Ionicons name="pencil" size={14} color={colors.primaryDark} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statsBoard}
            onPress={() => {
              tapLight();
              setReportOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="查看年度出行报告"
          >
            {(
              [
                [stats.tripCount, '行程'],
                [stats.cityCount, '城市'],
                [stats.totalDays, '天数'],
                [stats.reviewCount, '评价'],
              ] as const
            ).map(([num, label]) => (
              <View key={label} style={styles.statInner}>
                <Text style={styles.statNum}>{num}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </TouchableOpacity>
          <Text style={styles.reportCue}>点数据 · 生成年度旅行小结</Text>
        </View>

        <ProfileEditModal
          visible={editOpen}
          profile={userProfile}
          signature={signature}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveProfile}
        />
        <TravelPortraitEditModal
          visible={portraitEditOpen}
          portrait={portrait}
          onClose={() => setPortraitEditOpen(false)}
          onSave={patchPortrait}
        />
        <AnnualReportModal
          visible={reportOpen}
          trips={trips}
          displayName={userProfile.displayName}
          onClose={() => setReportOpen(false)}
        />

        {/* —— 画像主角 —— */}
        <ProfileSection title="旅行画像" tone="soft">
          <TravelPortraitCard
            portrait={portrait}
            reviewPrefs={prefs}
            inferredCompanionLabel={inferredCompanion}
            onEdit={() => setPortraitEditOpen(true)}
          />
        </ProfileSection>

        {/* —— 工具宫格 —— */}
        <ProfileSection title="出行工具" tone="soft">
          <ProfileToolGrid items={toolItems} />
        </ProfileSection>

        {/* —— 行程管家（降权） —— */}
        <ProfileSection title="行程管家" tone="compact">
          <ProfileActionRow
            icon="cloud-download-outline"
            label={restoring ? '正在恢复…' : '从云端恢复'}
            hint="换机后拉回备份"
            onPress={handleRestoreCloud}
          />
          <ProfileActionRow
            icon="archive-outline"
            label="导出行程备份"
            hint="保存一份行程文件"
            onPress={handleExport}
          />
          <ProfileActionRow
            icon="heart-outline"
            label="收藏的行程"
            onPress={() =>
              router.push({ pathname: '/(tabs)/community', params: { tab: 'favorites' } })
            }
            last
          />
        </ProfileSection>

        {/* —— 更多设置（折叠） —— */}
        <TouchableOpacity
          style={styles.moreToggle}
          onPress={() => {
            tapLight();
            setMoreOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
        >
          <Text style={styles.moreToggleText}>更多设置</Text>
          <Ionicons
            name={moreOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {moreOpen ? (
          <View style={styles.moreBlock}>
            <ProfileSection title="个性化" tone="compact">
              <ProfileSwitchRow
                label="长辈模式"
                hint="更大字号，适合陪长辈看行程"
                value={elderMode}
                onValueChange={setElderMode}
              />
              <ProfileSwitchRow
                label="增强触觉"
                hint="成功操作时轻震确认"
                value={soundOn}
                onValueChange={async (v) => {
                  await setSoundEnabled(v);
                  setSoundOn(v);
                }}
              />
              <ProfileSwitchRow
                label="出行提醒"
                hint="临近出行时提醒复看"
                value={proactiveOn}
                onValueChange={async (v) => {
                  await setProactiveEnabled(v);
                  setProactiveOn(v);
                }}
              />
              <ProfileSwitchRow
                label="AI 推荐偏小众"
                hint="更多本地味，少网红打卡"
                value={portrait.nicheRecommend}
                onValueChange={(v) => patchPortrait({ ...portrait, nicheRecommend: v })}
              />
              <ProfileSwitchRow
                label="云端自动同步"
                hint="保存行程时备份到云端"
                value={portrait.cloudAutoSync}
                onValueChange={(v) => patchPortrait({ ...portrait, cloudAutoSync: v })}
              />
              <ProfileSwitchRow
                label="个性化推荐授权"
                hint="画像与评价影响下次规划"
                value={portrait.personalizationAuth}
                onValueChange={(v) => patchPortrait({ ...portrait, personalizationAuth: v })}
                last
              />
            </ProfileSection>

            <ProfileSection title="外观" tone="compact">
              <View style={styles.themeRow}>
                {(
                  [
                    { key: 'system' as const, label: '系统', tone: '#F0EAE3' },
                    { key: 'light' as const, label: '浅色', tone: '#FFF8F4' },
                    { key: 'dark' as const, label: '深色', tone: '#2A2220' },
                  ] as const
                ).map((m) => {
                  const on = themeMode === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.themeChip, on && styles.themeChipOn]}
                      onPress={() => {
                        tapLight();
                        setThemeMode(m.key);
                      }}
                    >
                      <View style={[styles.themePreview, { backgroundColor: m.tone }]}>
                        <View
                          style={[
                            styles.themePreviewBar,
                            {
                              backgroundColor: m.key === 'dark' ? '#4ECDBF' : colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.themeChipText, on && styles.themeChipTextOn]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ProfileSection>

            <ProfileSection title="了解途灵" tone="compact">
              <ProfileAccordionItem title="我能帮你做什么">
                <InfoText>✓ 查签证、天气、美食攻略</InfoText>
                <InfoText>✓ 按表单规划多日行程</InfoText>
                <InfoText>✓ 保存行程、社区分享与评价</InfoText>
              </ProfileAccordionItem>
              <ProfileAccordionItem title="关于 AI 建议">
                <InfoText>AI 内容仅供参考，出行前请自行核实关键信息。</InfoText>
              </ProfileAccordionItem>
              <ProfileAccordionItem title="数据存在哪" last>
                <InfoText>行程主要在本机；保存时可同步云端，便于换机恢复。</InfoText>
              </ProfileAccordionItem>
            </ProfileSection>

            {devOpen ? (
              <ProfileSection title="服务器（演示）" tone="compact">
                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                  <InfoText>手机与电脑请同网；或用电脑热点 / USB + adb reverse。</InfoText>
                </View>
                <TextInput
                  value={apiDraft}
                  onChangeText={setApiDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={DEFAULT_API_BASE_URL}
                  placeholderTextColor={colors.textPlaceholder}
                  style={styles.apiInput}
                />
                <View style={styles.apiBtnRow}>
                  <TouchableOpacity
                    style={[styles.apiBtn, styles.apiBtnGhost]}
                    disabled={apiTesting || apiSaving}
                    onPress={async () => {
                      tapLight();
                      setApiTesting(true);
                      try {
                        await setApiBaseUrl(apiDraft);
                        const ok = await checkHealth();
                        if (ok) {
                          tapSuccess();
                          Alert.alert('连接成功', `已连通 ${getApiBaseUrl()}`);
                        } else {
                          tapError();
                          Alert.alert('连接失败', `打不开 ${getApiBaseUrl()}/health`);
                        }
                      } catch (e) {
                        tapError();
                        Alert.alert('地址无效', e instanceof Error ? e.message : String(e));
                      } finally {
                        setApiTesting(false);
                      }
                    }}
                  >
                    {apiTesting ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={styles.apiBtnGhostText}>测试连接</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.apiBtn, styles.apiBtnPrimary]}
                    disabled={apiTesting || apiSaving}
                    onPress={async () => {
                      tapLight();
                      setApiSaving(true);
                      try {
                        const url = await setApiBaseUrl(apiDraft);
                        setApiDraft(url);
                        tapSuccess();
                        Alert.alert('已保存', url);
                      } catch (e) {
                        tapError();
                        Alert.alert('保存失败', e instanceof Error ? e.message : String(e));
                      } finally {
                        setApiSaving(false);
                      }
                    }}
                  >
                    <Text style={styles.apiBtnPrimaryText}>{apiSaving ? '…' : '保存'}</Text>
                  </TouchableOpacity>
                </View>
                <ProfileActionRow
                  label="恢复默认地址"
                  hint={DEFAULT_API_BASE_URL}
                  onPress={async () => {
                    const url = await resetApiBaseUrl();
                    setApiDraft(url);
                    tapSuccess();
                  }}
                />
                <ProfileActionRow
                  label="USB 本机调试"
                  hint="http://127.0.0.1:3000"
                  onPress={() => setApiDraft('http://127.0.0.1:3000')}
                  last
                />
              </ProfileSection>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <TouchableOpacity
            onLongPress={() => {
              tapLight();
              setMoreOpen(true);
              setDevOpen(true);
              Alert.alert('', '已展开演示服务器设置（长按版本号）');
            }}
            delayLongPress={600}
          >
            <Text style={styles.footerText}>途灵 v{APP_VERSION}</Text>
          </TouchableOpacity>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => setLegalOpen('privacy')}>
              <Text style={styles.legalLink}>隐私政策</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => setLegalOpen('terms')}>
              <Text style={styles.legalLink}>用户协议</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/profile/help')}
        accessibilityRole="button"
        accessibilityLabel="快捷客服"
      >
        <Ionicons name="headset" size={22} color={colors.textOnPrimary} />
      </TouchableOpacity>

      <Modal
        visible={legalOpen !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLegalOpen(null)}
      >
        <View style={styles.legalOverlay}>
          <View style={styles.legalCard}>
            <Text style={styles.legalTitle}>
              {legalOpen === 'privacy' ? '隐私政策摘要' : '用户协议摘要'}
            </Text>
            <Text style={styles.legalBody}>
              {legalOpen === 'privacy'
                ? '设备标识用于匿名登录；行程主要存本机，保存时同步云端用于评价；评价用于个性化推荐且不公开身份；AI 对话经后端处理。'
                : '途灵提供 AI 行程规划与社区参考内容，不提供订票支付。AI 建议仅供参考，请自行核实。'}
            </Text>
            <TouchableOpacity style={styles.legalBtn} onPress={() => setLegalOpen(null)}>
              <Text style={styles.legalBtnText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 3,
  },
  heroBlock: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  heroWash: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  washTeal: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 220,
    height: 180,
    borderRadius: 110,
    backgroundColor: 'rgba(61,184,169,0.16)',
  },
  washPeach: {
    position: 'absolute',
    top: 20,
    right: -50,
    width: 200,
    height: 160,
    borderRadius: 100,
    backgroundColor: 'rgba(245,160,106,0.18)',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 8,
  },
  avatarGlow: {
    padding: 4,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 2,
    borderColor: 'rgba(61,184,169,0.35)',
  },
  heroText: { flex: 1, gap: 4 },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textStrong,
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  editPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  statsBoard: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,210,197,0.5)',
  },
  statInner: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  reportCue: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.accentDark,
    marginTop: 8,
    fontWeight: '600',
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  moreToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  moreBlock: { gap: spacing.md },
  themeRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  themeChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.bg,
    alignItems: 'center',
    gap: 6,
  },
  themeChipOn: {
    borderColor: colors.primary,
    backgroundColor: '#DDF4F0',
  },
  themePreview: {
    width: '100%',
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    justifyContent: 'flex-end',
    padding: 4,
  },
  themePreviewBar: {
    height: 6,
    width: '55%',
    borderRadius: 3,
  },
  themeChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  themeChipTextOn: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  infoText: {
    fontSize: font.tiny.size,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 2,
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.xs,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legalLink: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  legalDot: { color: colors.textPlaceholder },
  apiInput: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
  },
  apiBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  apiBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  apiBtnGhost: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  apiBtnGhostText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  apiBtnPrimary: { backgroundColor: colors.primary },
  apiBtnPrimaryText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  legalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(60,40,30,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  legalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  legalTitle: { fontSize: 17, fontWeight: '800', color: colors.textStrong },
  legalBody: { fontSize: 13, lineHeight: 20, color: colors.textMuted },
  legalBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  legalBtnText: { color: colors.textOnPrimary, fontWeight: '800' },
});
