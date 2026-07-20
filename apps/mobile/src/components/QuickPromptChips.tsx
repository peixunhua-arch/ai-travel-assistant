// 快捷问题 chip：空对话时给新用户几个「可以这样问」的例子，点一下直接发送。
//
// 为什么需要它？新用户打开 App 面对一个空输入框，常常不知道能问什么、这 AI 到底行不行。
// 给几个具体例子能极大降低「开口成本」——这是大纲里 ROI 最高的改动之一。
//
// ⚠️ 关键约束（大纲 3.1 / 4.2）：现在还没有「生成行程」接口，chip 一律是「闲聊」意图，
// 都走 /api/chat。所以措辞要避开「成都3天行程」这类会让用户以为能直接出一份行程的表达，
// 免得点了却只得到一段文字、预期落空。等阶段 2 表单上线，再单独给「生成行程」入口。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

// 默认的闲聊示例问题。都是「问答型」，不是「给我一份行程」。
const DEFAULT_PROMPTS = [
  '日本要签证吗',
  '周末周边游推荐',
  '带老人旅行要注意什么',
  '成都有什么好吃的',
];

const PLAN_CHIP = '帮我规划成都3天行程';

interface Props {
  // 点了某个 chip 之后干什么（由父组件决定：这里传给它去发送）
  onPick: (prompt: string) => void;
  /** 点规划类 chip 时优先走表单入口 */
  onPlanPick?: (prompt: string) => void;
  // 允许父组件自定义问题列表；不传就用默认的
  prompts?: string[];
  // loading 时禁用，避免连点
  disabled?: boolean;
}

export function QuickPromptChips({
  onPick,
  onPlanPick,
  prompts = DEFAULT_PROMPTS,
  disabled,
}: Props) {
  const all = onPlanPick ? [PLAN_CHIP, ...prompts] : prompts;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>你可以这样问：</Text>
      <View style={styles.chipRow}>
        {all.map((p) => {
          const isPlan = p === PLAN_CHIP;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.chip, isPlan && styles.planChip, disabled && styles.chipDisabled]}
              onPress={() => (isPlan && onPlanPick ? onPlanPick(p) : onPick(p))}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={isPlan ? `规划行程：${p}` : `快捷提问：${p}`}
            >
              <Text style={[styles.chipText, isPlan && styles.planChipText]}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDisabled: { opacity: 0.5 },
  chipText: {
    color: colors.textPrimary,
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    fontWeight: '500',
  },
  planChip: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  planChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
