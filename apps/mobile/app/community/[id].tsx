// 社区帖子详情：正文 + 点赞/收藏 + 评论列表。
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { CommunityPostDetail } from '@travel/shared';
import { fetchCommunityPost, togglePostLike, togglePostFavorite, postCommunityComment } from '../../src/api';
import { UserAvatar } from '../../src/components/UserAvatar';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapLight, tapSuccess, tapError } from '../../src/haptics';
import { safeGoBack } from '../../src/navigation';

const TYPE_LABEL = {
  trip: '🗺️ 行程分享',
  photo: '📷 旅拍分享',
  review: '⭐ 评价分享',
} as const;

export default function CommunityPostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<CommunityPostDetail | null | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setPost(await fetchCommunityPost(id));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLike = async () => {
    if (!post) return;
    tapLight();
    const res = await togglePostLike(post.id);
    if (!res) return tapError();
    setPost({
      ...post,
      likedByMe: res.active,
      likeCount: res.likeCount ?? post.likeCount,
    });
  };

  const handleFavorite = async () => {
    if (!post) return;
    tapLight();
    const res = await togglePostFavorite(post.id);
    if (!res) return tapError();
    setPost({
      ...post,
      favoritedByMe: res.active,
      favoriteCount: res.favoriteCount ?? post.favoriteCount,
    });
  };

  const handleComment = async () => {
    if (!post || !comment.trim() || submitting) return;
    setSubmitting(true);
    const created = await postCommunityComment(post.id, { text: comment.trim() });
    setSubmitting(false);
    if (!created) {
      tapError();
      Alert.alert('', '评论失败，请稍后重试');
      return;
    }
    tapSuccess();
    setComment('');
    setPost({
      ...post,
      comments: [...post.comments, created],
      commentCount: post.commentCount + 1,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeGoBack(router, '/(tabs)/community')}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>帖子详情</Text>
        <View style={styles.headerSpacer} />
      </View>

      {post === null ? (
        <View style={styles.center}>
          <Text style={styles.muted}>帖子不存在或已删除</Text>
        </View>
      ) : post ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.authorRow}>
              {post.authorAvatar ? (
                <UserAvatar avatar={post.authorAvatar} size={40} />
              ) : null}
              <Text style={styles.author}>{post.authorLabel}</Text>
            </View>
            <Text style={styles.type}>{TYPE_LABEL[post.type]}</Text>
            <Text style={styles.title}>{post.title}</Text>
            {post.destination ? (
              <Text style={styles.meta}>
                {post.destination}
                {post.daysCount ? ` · ${post.daysCount} 天` : ''}
              </Text>
            ) : null}
            {post.coverPhoto ? (
              <Image source={{ uri: post.coverPhoto }} style={styles.cover} resizeMode="cover" />
            ) : null}
            <Text style={styles.body}>{post.body}</Text>

            {post.tripSnapshot?.highlightItems && post.tripSnapshot.highlightItems.length > 0 && (
              <View style={styles.highlightBox}>
                <Text style={styles.highlightTitle}>行程亮点</Text>
                {post.tripSnapshot.highlightItems.map((item, i) => (
                  <Text key={`${item.name}-${i}`} style={styles.highlightItem}>
                    · {item.name}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                <Text style={[styles.actionText, post.likedByMe && styles.actionActive]}>
                  {post.likedByMe ? '❤️' : '🤍'} 赞 {post.likeCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleFavorite}>
                <Text style={[styles.actionText, post.favoritedByMe && styles.actionActive]}>
                  {post.favoritedByMe ? '⭐' : '☆'} 收藏 {post.favoriteCount}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.commentHeader}>评论 ({post.commentCount})</Text>
            {post.comments.length === 0 ? (
              <Text style={styles.muted}>还没有评论，来抢沙发吧</Text>
            ) : (
              post.comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <Text style={styles.commentAuthor}>{c.authorLabel}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              placeholder="写评论…"
              placeholderTextColor={colors.textPlaceholder}
              value={comment}
              onChangeText={setComment}
              maxLength={200}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!comment.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={handleComment}
              disabled={!comment.trim() || submitting}
            >
              <Text style={styles.sendBtnText}>发送</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
  headerSpacer: { width: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: font.body.size, color: colors.textMuted },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  author: { fontSize: font.small.size, fontWeight: '700', color: colors.textStrong },
  type: { fontSize: font.tiny.size, color: colors.primaryDark, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textStrong },
  meta: { fontSize: font.small.size, color: colors.textMuted },
  cover: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
  },
  body: {
    fontSize: font.body.size,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  highlightBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  highlightTitle: { fontSize: font.small.size, fontWeight: '700', color: colors.textStrong },
  highlightItem: { fontSize: font.small.size, color: colors.textPrimary },
  actions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: font.body.size, color: colors.textMuted, fontWeight: '600' },
  actionActive: { color: colors.primary },
  commentHeader: {
    fontSize: font.body.size,
    fontWeight: '700',
    color: colors.textStrong,
    marginTop: spacing.sm,
  },
  commentItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  commentAuthor: { fontSize: font.tiny.size, fontWeight: '700', color: colors.textMuted },
  commentText: { fontSize: font.body.size, color: colors.textPrimary, lineHeight: 22 },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: colors.textOnPrimary, fontWeight: '700' },
});
