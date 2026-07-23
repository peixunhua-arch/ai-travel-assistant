// 行程里的「一条安排」卡片：左边一列放时间 + 类型 emoji，右边放名称（粗）+ 说明（灰）。
//
// 阶段 3 新增：如果这条 item 带了 links（后端按 poiId 回填成功的真实 POI 才有），
// 就在说明下方多显示一块「真实数据区」：评分/地址（有才显示）+ 三个跳转小按钮（导航/小红书/大众点评）。
//
// ⚠️ 延续阶段 2 的原则：links 不存在时（阶段 2 存的老行程、或本次没回填成功的点）绝不画任何
// 空占位框——直接维持「只有 time/emoji/name/description」的老样子，宁可不显示也不留空框。
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useState } from 'react';
import type { TripItem, ReviewState, PoiReputation } from '@travel/shared';
import { TRIP_TYPE_META } from '../tripTypes';
import { openLink } from '../linking';
import { ReviewButtons } from './ReviewButtons';
import { CommunityBadge } from './CommunityBadge';
import { SourceBadgeRow } from './SourceBadge';
import { colors, spacing, radius, font } from '../theme';
import { useElderMode, useScaledFont } from '../lib/elderMode';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function TripItemCard({
  item,
  review,
  reputation,
  onReview,
  reviewDisabled,
  collapsible = false,
  highlighted = false,
  onSelectMap,
  pendingSync,
}: {
  item: TripItem;
  review?: ReviewState | null;
  reputation?: PoiReputation | null;
  onReview?: (sentiment: 1 | -1, tags: string[], comment?: string) => void;
  reviewDisabled?: boolean;
  collapsible?: boolean;
  highlighted?: boolean;
  /** §5.2 点击卡片同步地图高亮 */
  onSelectMap?: () => void;
  /** §7.5 离线评价待同步 */
  pendingSync?: boolean;
}) {
  const { enabled: elder, touchMin } = useElderMode();
  const sf = useScaledFont();
  const [expanded, setExpanded] = useState(!collapsible && !elder);
  const meta = TRIP_TYPE_META[item.type];
  const links = item.links; // 阶段 3 回填才有；老行程/未命中为 undefined
  const hasAmap = item.dataSources?.place === 'amap' || !!links;
  const a11yLabel = `${item.time}，${meta.label}，${item.name}${item.rating !== undefined ? `，评分 ${item.rating.toFixed(1)}` : ''}`;

  const toggleExpand = () => {
    if (!collapsible || elder) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const isTransport = item.type === 'transport';
  return (
    <View style={[styles.row, isTransport && styles.transportRow, highlighted && styles.highlighted]}>
      {/* 左列：时间 + emoji。固定宽度，让右侧文字整齐对齐。 */}
      <View style={styles.left}>
        <Text style={[styles.time, { fontSize: sf.small.size }]} allowFontScaling>{item.time}</Text>
        <Text style={styles.emoji} accessibilityLabel={meta.label}>{meta.emoji}</Text>
      </View>
      {/* 右列：名称 + 一句话说明 */}
      <View style={styles.right}>
        <TouchableOpacity
          onPress={() => {
            if (collapsible && !expanded) {
              toggleExpand();
              return;
            }
            if (onSelectMap) onSelectMap();
          }}
          onLongPress={toggleExpand}
          disabled={!collapsible && !onSelectMap}
          activeOpacity={collapsible || onSelectMap ? 0.7 : 1}
          accessibilityRole={collapsible ? 'button' : 'text'}
          accessibilityLabel={a11yLabel}
        >
          <Text style={[styles.name, { fontSize: sf.body.size, lineHeight: sf.body.lineHeight }, isTransport && styles.transportName]} allowFontScaling>
            {item.name}
          </Text>
        </TouchableOpacity>
        {!elder && collapsible && !expanded ? (
          <TouchableOpacity
            onPress={toggleExpand}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="展开行程详情"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {item.opentime ? (
              <Text style={styles.opentime}>🕐 营业 {item.opentime}</Text>
            ) : null}
            <SourceBadgeRow hasAmap={hasAmap} />
            <Text style={styles.expandHint}>点击展开详情</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!elder && item.opentime ? (
              <Text style={styles.opentime}>🕐 营业 {item.opentime}</Text>
            ) : null}
            {!elder && <SourceBadgeRow hasAmap={hasAmap} />}
            {!elder && (expanded || !collapsible) && <Text style={styles.desc}>{item.description}</Text>}
          </>
        )}

        {/* 长辈模式：只保留导航 */}
        {elder && links && (
          <TouchableOpacity
            style={[styles.linkBtn, styles.elderNavBtn, { minHeight: touchMin }]}
            onPress={() => openLink(links.mapUrl, links.mapUrl)}
            accessibilityRole="button"
            accessibilityLabel={`导航到 ${item.name}`}
          >
            <Text style={[styles.linkText, { fontSize: sf.body.size }]}>📍 导航</Text>
          </TouchableOpacity>
        )}

        {/* 阶段 3：真实数据区。只有 links 存在（= 后端回填成功）才整块显示。 */}
        {!elder && links && (expanded || !collapsible) && (
          <>
            {/* 评分 + 地址：各自「有才显示」，都没有就不画这行。 */}
            {(item.rating !== undefined || item.address) && (
              <Text style={styles.meta} numberOfLines={2}>
                {item.rating !== undefined && (
                  <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text>
                )}
                {item.rating !== undefined && item.address ? '  ' : ''}
                {item.address ?? ''}
              </Text>
            )}
            {reputation && <CommunityBadge reputation={reputation} />}
            {/* 三个跳转小按钮：均为「按名搜索」入口，不是从该平台抓取的数据。 */}
            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openLink(links.mapUrl, links.mapUrl)}
                accessibilityRole="button"
                accessibilityLabel={`在地图查看 ${item.name}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.linkText}>📍 导航</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openLink(links.xhsScheme, links.xhsUrl)}
                accessibilityRole="button"
                accessibilityLabel={`在小红书搜索 ${item.name}`}
              >
                <Text style={styles.linkText}>🔴 搜小红书</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => openLink(links.dianpingScheme, links.dianpingUrl)}
                accessibilityRole="button"
                accessibilityLabel={`在大众点评搜索 ${item.name}`}
              >
                <Text style={styles.linkText}>🟠 搜点评</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.linkHint}>
              地点来自高德；小红书/点评为按店名搜索，各平台收录不同，搜不到属正常
            </Text>
          </>
        )}

        {/* 单点评价（阶段 3.5）：有 poiId 且可评价时才显示 */}
        {item.poiId && onReview && !elder && (
          <View style={styles.reviewBox}>
            <ReviewButtons
              current={review ?? null}
              onSubmit={onReview}
              disabled={reviewDisabled}
              pendingSync={pendingSync}
            />
          </View>
        )}
      </View>

      {/* 缩略图：有高德图用真图；无图用类型色占位（§5.1） */}
      {item.type !== 'transport' && !elder && (
        item.photoUrl ? (
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.thumb}
            onError={() => console.warn('[TripItemCard] 缩略图加载失败:', item.photoUrl)}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: meta.color + '22' }]}>
            <Text style={styles.thumbEmoji}>{meta.emoji}</Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  highlighted: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  transportRow: {
    opacity: 0.65,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  transportName: {
    fontWeight: '500',
    color: colors.textMuted,
  },
  left: {
    width: 52,
    alignItems: 'center',
  },
  time: {
    fontSize: font.small.size,
    color: colors.textStrong,
    fontWeight: '600',
  },
  emoji: {
    fontSize: 18,
    marginTop: spacing.xs,
  },
  right: {
    flex: 1,
  },
  name: {
    fontSize: font.body.size,
    lineHeight: font.body.lineHeight,
    color: colors.textStrong,
    fontWeight: '600',
    marginBottom: 2,
  },
  desc: {
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    color: colors.textMuted,
  },
  opentime: {
    fontSize: font.tiny.size,
    color: colors.warningText,
    marginTop: 2,
  },
  expandHint: {
    fontSize: font.tiny.size,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  // ↓ 阶段 3 真实数据区
  meta: {
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  rating: {
    color: colors.accentFood, // 橙色星级，比灰字更显眼
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  linkText: {
    fontSize: font.tiny.size,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  linkHint: {
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  elderNavBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: {
    fontSize: 28,
  },
  reviewBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
