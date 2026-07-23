// §16.2 数据来源标注：地点真值（高德）vs AI 文案；外链标明「仅搜索、非抓取」。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export type SourceKind = 'amap' | 'ai' | 'ai_only' | 'search';

const LABEL: Record<SourceKind, string> = {
  amap: '地点·高德',
  ai: '理由·AI',
  ai_only: 'AI 建议',
  search: '外链·仅搜索',
};

export function SourceBadge({ source }: { source: SourceKind }) {
  const toneStyle =
    source === 'amap' ? styles.amap : source === 'search' ? styles.search : styles.ai;
  const textStyle =
    source === 'amap'
      ? styles.amapText
      : source === 'search'
        ? styles.searchText
        : styles.aiText;
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.text, textStyle]}>{LABEL[source]}</Text>
    </View>
  );
}

/** 按是否回填高德，展示一组来源角标 */
export function SourceBadgeRow({ hasAmap }: { hasAmap: boolean }) {
  if (!hasAmap) {
    return (
      <View style={styles.row}>
        <SourceBadge source="ai_only" />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <SourceBadge source="amap" />
      <SourceBadge source="ai" />
      <SourceBadge source="search" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  amap: {
    backgroundColor: colors.successBg,
  },
  ai: {
    backgroundColor: colors.inputBg,
  },
  search: {
    backgroundColor: colors.primaryBg,
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
  searchText: {
    color: colors.primary,
  },
});
