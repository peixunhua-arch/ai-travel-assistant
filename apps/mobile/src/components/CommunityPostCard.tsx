// 社区瀑布流卡片：封面优先 + 标题 + 作者/点赞（发现流结构）。
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { CommunityPostSummary } from '@travel/shared';
import { UserAvatar } from './UserAvatar';
import { colors, spacing, radius } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_META: Record<
  CommunityPostSummary['type'],
  { label: string; icon: IconName; tint: string }
> = {
  trip: { label: '行程', icon: 'map-outline', tint: colors.primary },
  photo: { label: '旅拍', icon: 'camera-outline', tint: colors.accent },
  review: { label: '评价', icon: 'star-outline', tint: colors.accentHotel },
};

function coverHeight(postId: string, hasCover: boolean): number {
  let h = 0;
  for (let i = 0; i < postId.length; i++) h = (h + postId.charCodeAt(i) * (i + 3)) % 97;
  const base = hasCover ? 140 : 110;
  return base + (h % 70); // 110~209 / 140~209
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface Props {
  post: CommunityPostSummary;
  onPress: () => void;
  onLike?: () => void;
}

export function CommunityPostCard({ post, onPress, onLike }: Props) {
  const { width } = useWindowDimensions();
  const colW = (width - spacing.md * 2 - spacing.sm) / 2;
  const meta = TYPE_META[post.type];
  const h = coverHeight(post.id, !!post.coverPhoto);

  return (
    <TouchableOpacity
      style={[styles.card, { width: colW }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={post.title}
    >
      <View style={[styles.coverWrap, { height: h }]}>
        {post.coverPhoto ? (
          <Image source={{ uri: post.coverPhoto }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name={meta.icon} size={28} color={meta.tint} />
            {post.destination ? (
              <Text style={styles.coverDest} numberOfLines={1}>
                {post.destination}
              </Text>
            ) : (
              <Text style={styles.coverDest}>{meta.label}</Text>
            )}
          </View>
        )}
        <View style={styles.typePill}>
          <Text style={styles.typePillText}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>
        {(post.destination || post.daysCount) && (
          <Text style={styles.metaLine} numberOfLines={1}>
            {[post.destination, post.daysCount ? `${post.daysCount}天` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.author}>
            {post.authorAvatar ? (
              <UserAvatar avatar={post.authorAvatar} size={18} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={10} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.authorName} numberOfLines={1}>
              {post.authorLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.likeBtn}
            onPress={onLike}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="点赞"
          >
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={14}
              color={post.likedByMe ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.likeCount, post.likedByMe && styles.likeActive]}>
              {formatCount(post.likeCount)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  coverWrap: {
    width: '100%',
    backgroundColor: colors.inputBg,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  coverDest: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  typePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textStrong,
  },
  body: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.textStrong,
  },
  metaLine: {
    fontSize: 11,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  author: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  avatar: {
    borderWidth: 0,
  },
  avatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  likeCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  likeActive: {
    color: colors.accentDark,
  },
});
