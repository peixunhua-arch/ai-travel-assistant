// 首次启动引导：新用户第一次打开 App 时，全屏盖一层 3 张卡片，简单说清「这 App 能干嘛」。
// 看完点「开始使用」，用 AsyncStorage 记一个标记 hasSeenOnboarding，以后就不再出现。
//
// 为什么只在首次显示？引导对老用户是打扰。用一个本地布尔标记控制「只看一次」，
// 是 App 引导页最常见的做法。清除 App 数据 / 重装会重置这个标记（属正常）。
//
// 交互：左右滑动切卡片（横向 FlatList + pagingEnabled）；底部小圆点指示第几张；
// 最后一张显示「开始使用」，前面几张显示「下一步」/「跳过」。
import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../theme';

// AsyncStorage 里记「看过引导没」的 key
export const ONBOARDING_KEY = 'hasSeenOnboarding';

interface Slide {
  emoji: string;
  title: string;
  desc: string;
}

const SLIDES: Slide[] = [
  {
    emoji: '💬',
    title: '随便问，随便聊',
    desc: '签证、天气、美食、玩法……旅行相关的问题都能问，像和朋友聊天一样。',
  },
  {
    emoji: '🗺️',
    title: '帮你规划行程',
    desc: '填目的地和天数，AI 会查真实天气和地点，生成可保存的每日路线。',
  },
  {
    emoji: '📌',
    title: '存到「我的行程」',
    desc: '满意的行程保存到本地，随时翻看；评价后下次推荐会更贴合你的口味。',
  },
];

interface Props {
  // 引导结束（点了开始/跳过）后通知父组件，把这层收起来
  onDone: () => void;
}

export function OnboardingSlides({ onDone }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  // 记标记 + 关闭
  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  };

  // 滑动停下时，根据滚动位置算出当前是第几张
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.overlay}>
      {/* 顶部「跳过」（最后一张就不显示了） */}
      <View style={styles.topBar}>
        {!isLast && (
          <TouchableOpacity onPress={finish} accessibilityRole="button">
            <Text style={styles.skip}>跳过</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* 底部圆点指示 */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.cta} onPress={goNext} accessibilityRole="button">
        <Text style={styles.ctaText}>{isLast ? '开始使用' : '下一步'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 10,
  },
  topBar: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  skip: { color: colors.textMuted, fontSize: font.body.size },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emoji: { fontSize: 72, marginBottom: spacing.xl },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textStrong,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  desc: {
    fontSize: font.body.size,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  cta: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
});
