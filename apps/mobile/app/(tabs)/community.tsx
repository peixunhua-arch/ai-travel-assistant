// 「社区」Tab：发现流双列瀑布布局（封面 + 标题 + 作者/点赞）。
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CommunityPostSummary } from '@travel/shared';
import {
  fetchCommunityPosts,
  fetchFavoritePosts,
  togglePostLike,
} from '../../src/api';
import { CommunityPostCard } from '../../src/components/CommunityPostCard';
import { CommunityListSkeleton } from '../../src/components/CommunityListSkeleton';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors, spacing, font, radius, shadow } from '../../src/theme';
import { tapLight } from '../../src/haptics';

type FeedTab = 'all' | 'favorites' | 'trip' | 'photo';
const PAGE_SIZE = 20;

export default function CommunityTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<FeedTab>(params.tab === 'favorites' ? 'favorites' : 'all');
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    if (params.tab === 'favorites' || params.tab === 'all') {
      setTab(params.tab);
    }
  }, [params.tab]);

  const load = useCallback(async (mode: 'replace' | 'append', feed: FeedTab) => {
    try {
      setError(null);
      if (feed === 'favorites') {
        const items = await fetchFavoritePosts();
        setPosts(items);
        setHasMore(false);
        return;
      }
      const offset = mode === 'append' ? postsRef.current.length : 0;
      const items = await fetchCommunityPosts({ limit: PAGE_SIZE, offset });
      setPosts((prev) => (mode === 'append' ? [...prev, ...items] : items));
      setHasMore(items.length >= PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      if (mode === 'replace') setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setHasMore(tab === 'all' || tab === 'trip' || tab === 'photo');
      load('replace', tab === 'trip' || tab === 'photo' ? 'all' : tab);
    }, [tab, load]),
  );

  const visiblePosts = useMemo(() => {
    if (tab === 'trip') return posts.filter((p) => p.type === 'trip');
    if (tab === 'photo') return posts.filter((p) => p.type === 'photo' || p.type === 'review');
    return posts;
  }, [posts, tab]);

  const { leftCol, rightCol } = useMemo(() => {
    const left: CommunityPostSummary[] = [];
    const right: CommunityPostSummary[] = [];
    visiblePosts.forEach((p, i) => {
      if (i % 2 === 0) left.push(p);
      else right.push(p);
    });
    return { leftCol: left, rightCol: right };
  }, [visiblePosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    setHasMore(tab !== 'favorites');
    await load('replace', tab === 'trip' || tab === 'photo' ? 'all' : tab);
  };

  const tryLoadMore = async () => {
    if (tab === 'favorites' || loading || loadingMore || refreshing || !hasMore || error) return;
    setLoadingMore(true);
    await load('append', 'all');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 240) {
      tryLoadMore();
    }
  };

  const switchTab = (next: FeedTab) => {
    if (next === tab) return;
    setTab(next);
    setLoading(true);
    if (next === 'favorites' || next === 'all') {
      setPosts([]);
    }
    setHasMore(next !== 'favorites');
  };

  const updatePost = (id: string, patch: Partial<CommunityPostSummary>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleLike = async (post: CommunityPostSummary) => {
    tapLight();
    const res = await togglePostLike(post.id);
    if (!res) return;
    updatePost(post.id, {
      likedByMe: res.active,
      likeCount: res.likeCount ?? post.likeCount,
    });
  };

  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'all', label: '发现' },
    { key: 'trip', label: '行程' },
    { key: 'photo', label: '旅拍' },
    { key: 'favorites', label: '收藏' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>社区</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              tapLight();
              router.push('/community/create');
            }}
            accessibilityLabel="发布帖子"
          >
            <Ionicons name="add" size={22} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabBtn} onPress={() => switchTab(t.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlineGap} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {error && !loading ? (
        <View style={styles.errorWrap}>
          <ErrorBanner
            message={error}
            onRetry={() => {
              setLoading(true);
              load('replace', tab === 'favorites' ? 'favorites' : 'all');
            }}
          />
        </View>
      ) : null}

      {loading ? (
        <CommunityListSkeleton />
      ) : visiblePosts.length === 0 && !error ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="images-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {tab === 'favorites' ? '还没有收藏' : '社区还是空的'}
          </Text>
          <Text style={styles.emptyDesc}>
            {tab === 'favorites'
              ? '在帖子详情里收藏后，会出现在这里'
              : '分享行程或旅拍，成为第一个发帖的人'}
          </Text>
          {tab !== 'favorites' && (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push('/community/create')}
            >
              <Text style={styles.ctaText}>去发布</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : visiblePosts.length === 0 ? null : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onScroll={onScroll}
          scrollEventThrottle={120}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            <View style={styles.col}>
              {leftCol.map((item) => (
                <CommunityPostCard
                  key={item.id}
                  post={item}
                  onPress={() => router.push(`/community/${item.id}`)}
                  onLike={() => handleLike(item)}
                />
              ))}
            </View>
            <View style={styles.col}>
              {rightCol.map((item) => (
                <CommunityPostCard
                  key={item.id}
                  post={item}
                  onPress={() => router.push(`/community/${item.id}`)}
                  onLike={() => handleLike(item)}
                />
              ))}
            </View>
          </View>
          {loadingMore ? (
            <View style={styles.footerLoad}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    ...shadow.soft,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textStrong,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm + 2,
  },
  tabText: {
    fontSize: font.body.size,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  tabTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 16,
  },
  tabUnderline: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  tabUnderlineGap: {
    width: 22,
    height: 3,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  col: {
    flex: 1,
  },
  footerLoad: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  errorWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
  },
  emptyDesc: {
    fontSize: font.small.size,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  ctaText: { color: colors.textOnPrimary, fontWeight: '800' },
});
