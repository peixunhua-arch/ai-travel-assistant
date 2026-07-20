// 等待提示：AI 在思考时显示的那一行。比原来的单行「AI 正在思考…」多两件事：
//   1. 文案分阶段轮播（正在理解你的需求… → 正在整理建议…），让人感觉「它在动」，不是卡死；
//   2. 等超过 15 秒，追加一句「通常需要 30～60 秒，请稍候」，给用户一个心理预期。
//
// 为什么这么做？阶段 2 的「生成行程」可能要 60 秒以上，长时间空白是最大的流失点。
// 现在闲聊虽然快，但先把这套「分阶段 + 超时安抚」的骨架搭好，阶段 2 直接换文案就能用。
//
// 白话原理：用 setInterval 每隔几秒换一句文案；用 setTimeout 到 15 秒时亮出那句安抚语。
// 组件卸载（AI 回来了）时把这两个定时器清掉，不然会内存泄漏 / 报警告。
import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../theme';

// 轮播的阶段文案。阶段 2 接入行程生成后，可换成
// ['正在查询地点…','正在生成行程…','正在补充地址…'] 这种更贴合的。
const PHASES = ['正在理解你的需求…', '正在整理建议…'];

// 每隔多久换一句（毫秒）
const ROTATE_MS = 2500;
// 等多久之后显示「通常需要 30～60 秒」
const SLOW_HINT_MS = 15000;

export function TypingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    // 定时轮播文案：到最后一句就停住，不循环回第一句（避免来回跳显得假）
    const rotate = setInterval(() => {
      setPhaseIndex((i) => (i < PHASES.length - 1 ? i + 1 : i));
    }, ROTATE_MS);

    // 15 秒后亮出安抚语
    const slowTimer = setTimeout(() => setShowSlowHint(true), SLOW_HINT_MS);

    // 组件消失时清理，防止定时器在后台空跑
    return () => {
      clearInterval(rotate);
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.text}>{PHASES[phaseIndex]}</Text>
      </View>
      {showSlowHint && <Text style={styles.slowHint}>通常需要 30～60 秒，请稍候</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    color: colors.textMuted,
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
  },
  slowHint: {
    color: colors.textMuted,
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
    marginLeft: spacing.xl, // 和上面的文字对齐（避开转圈图标）
  },
});
