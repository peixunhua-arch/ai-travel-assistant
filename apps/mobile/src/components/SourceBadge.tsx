// §16.2 数据来源标注：区分高德实时数据 vs AI 生成文案。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

type Source = 'amap' | 'ai';

export function SourceBadge({ source }: { source: Source }) {
  const isAmap = source === 'amap';
  return (
    <View style={[styles.badge, isAmap ? styles.amap : styles.ai]}>
      <Text style={[styles.text, isAmap ? styles.amapText : styles.aiText]}>
        {isAmap ? '高德实时' : 'AI 建议'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  amap: {
    backgroundColor: colors.successBg,
  },
  ai: {
    backgroundColor: colors.inputBg,
  },
  text: {
    fontSize: font.tiny.size,
    fontWeight: '600',
  },
  amapText: {
    color: colors.success,
  },
  aiText: {
    color: colors.textMuted,
  },
});
