// 评价按钮组件（阶段 3.5）：一份行程（整程）或一个 POI（单点）的赞/踩 + 标签 + 短评。
//
// 设计成「受控 + 回调」：自己不发网络请求，只把用户选的 (sentiment, tags, comment) 通过 onSubmit
// 交出去；发请求、刷新回显、触觉反馈都由调用方（详情页）统一做。好处是逻辑集中、这个组件纯 UI 好复用。
//
// 交互：
//   1) 一行两个大按钮 👍 值得 / 👎 踩雷。current 命中则常亮高亮（绿/红）。
//   2) 点任一个 → 就地展开：该情绪的标签多选 + 可选短评（≤50 字）+「提交」。
//   3) 已评过（current 有值）进来就展开、回填已选情绪与标签，可改可重交（后端 upsert 覆盖）。
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { ReviewState } from '@travel/shared';
import { colors, spacing, radius, font } from '../theme';
import { useElderMode, useScaledFont } from '../lib/elderMode';

// 标签库（来自 UX §7.2）：赞一组、踩一组。
const TAGS_UP = ['性价比高', '值得去', '本地人多', '交通方便'];
const TAGS_DOWN = ['太赶', '踩雷', '排队久', '名不副实'];

type Sentiment = 1 | -1;

export function ReviewButtons({
  current,
  onSubmit,
  disabled,
  pendingSync,
}: {
  current: ReviewState | null;
  onSubmit: (sentiment: Sentiment, tags: string[], comment?: string) => void;
  disabled?: boolean;
  /** §7.5 离线评价待同步角标 */
  pendingSync?: boolean;
}) {
  const { touchMin } = useElderMode();
  const sf = useScaledFont();
  // 当前选的情绪：优先回显已评的；没评过则 null（两个按钮都不高亮、不展开下半区）。
  const [sentiment, setSentiment] = useState<Sentiment | null>(current?.sentiment ?? null);
  const [tags, setTags] = useState<string[]>(current?.tags ?? []);
  const [comment, setComment] = useState(current?.comment ?? '');
  const [customTag, setCustomTag] = useState('');

  // 点 👍/👎：切换情绪。切到另一种情绪时清空标签（两组标签不通用）。
  const pick = (s: Sentiment) => {
    if (disabled) return;
    if (s !== sentiment) {
      setSentiment(s);
      setTags([]); // 换了情绪，旧标签作废
    }
  };

  const toggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = () => {
    if (sentiment === null || disabled) return;
    const trimmedCustom = customTag.trim().slice(0, 8);
    const finalTags = trimmedCustom
      ? [...tags.filter((t) => tagPool.includes(t)), trimmedCustom]
      : tags;
    onSubmit(sentiment, finalTags, comment.trim() || undefined);
  };

  const tagPool = sentiment === 1 ? TAGS_UP : TAGS_DOWN;

  return (
    <View style={styles.wrap}>
      {pendingSync && (
        <Text style={styles.pendingBadge}>待同步</Text>
      )}
      {/* 赞 / 踩 两个大按钮 */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.voteBtn, { minHeight: touchMin }, sentiment === 1 && styles.voteUpActive]}
          onPress={() => pick(1)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="值得"
          accessibilityState={{ selected: sentiment === 1 }}
        >
          <Text style={[styles.voteText, { fontSize: sf.body.size }, sentiment === 1 && styles.voteUpText]}>👍 值得</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteBtn, { minHeight: touchMin }, sentiment === -1 && styles.voteDownActive]}
          onPress={() => pick(-1)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="踩雷"
          accessibilityState={{ selected: sentiment === -1 }}
        >
          <Text style={[styles.voteText, { fontSize: sf.body.size }, sentiment === -1 && styles.voteDownText]}>👎 踩雷</Text>
        </TouchableOpacity>
      </View>

      {/* 选了情绪才展开：标签多选 + 短评 + 提交 */}
      {sentiment !== null && (
        <View style={styles.expand}>
          <View style={styles.tagRow}>
            {tagPool.map((t) => {
              const on = tags.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tag, on && styles.tagOn]}
                  onPress={() => toggleTag(t)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.customTagInput}
            placeholder="自定义标签（可选，≤8 字）"
            placeholderTextColor={colors.textPlaceholder}
            value={customTag}
            onChangeText={(t) => setCustomTag(t.slice(0, 8))}
            editable={!disabled}
            maxLength={8}
            accessibilityLabel="自定义评价标签"
          />

          <TextInput
            style={styles.input}
            placeholder="补充一句（可选，≤50 字）"
            placeholderTextColor={colors.textPlaceholder}
            value={comment}
            onChangeText={setComment}
            editable={!disabled}
            maxLength={50}
          />

          <TouchableOpacity
            style={[styles.submit, disabled && styles.submitDisabled]}
            onPress={submit}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="提交评价"
          >
            <Text style={styles.submitText}>提交评价</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  pendingBadge: {
    alignSelf: 'flex-start',
    fontSize: font.tiny.size,
    color: colors.warningText,
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: spacing.md },
  voteBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  voteUpActive: { borderColor: colors.success, backgroundColor: colors.successBg },
  voteDownActive: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  voteText: { fontSize: font.body.size, color: colors.textPrimary, fontWeight: '600' },
  voteUpText: { color: colors.success },
  voteDownText: { color: colors.danger },

  expand: { gap: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  tagText: { fontSize: font.small.size, color: colors.textPrimary },
  tagTextOn: { color: colors.textOnPrimary, fontWeight: '600' },

  customTagInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.small.size,
    color: colors.textPrimary,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.body.size,
    color: colors.textPrimary,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: colors.primaryDisabled },
  submitText: { color: colors.textOnPrimary, fontSize: font.body.size, fontWeight: '700' },
});
