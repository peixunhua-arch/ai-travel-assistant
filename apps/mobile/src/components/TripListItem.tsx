// 「行程」列表卡片：标签 / 出行时间 / 预算档位 / 三点菜单 / 左滑删除。
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Share,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import type { SavedTrip } from '@travel/shared';
import { colors, spacing, radius, font, shadow } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';

const COMPANION_LABEL: Record<string, string> = {
  solo: '独自',
  couple: '情侣',
  family: '亲子',
  elder: '带老人',
  friends: '朋友结伴',
};

const ACCENT_BY_COMPANION: Record<string, string> = {
  solo: '#4A6FA5', // 靛蓝
  couple: '#C85A7A', // 胭脂
  family: '#5BAA5E', // 竹绿
  elder: '#C8804A', // 赭石
  friends: '#3DA89A', // 青碧
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function budgetTier(trip: SavedTrip): { label: string; amount: string } {
  const user = trip.insights?.userBudget;
  const estimate = trip.budgetEstimate;
  const ref = user !== undefined && user > 0 ? user : estimate;
  if (user === 0 || (ref <= 0 && estimate <= 0)) {
    return { label: '不限', amount: estimate > 0 ? `预估 ${estimate} 元` : '预算灵活' };
  }
  if (ref <= 4000) return { label: '经济', amount: `约 ${estimate || ref} 元` };
  if (ref <= 10000) return { label: '舒适', amount: `约 ${estimate || ref} 元` };
  return { label: '高端', amount: `约 ${estimate || ref} 元` };
}

function buildTags(trip: SavedTrip): string[] {
  const tags: string[] = [];
  if (trip.insights?.companions) {
    tags.push(COMPANION_LABEL[trip.insights.companions] ?? trip.insights.companions);
  }
  const prefs = trip.insights?.preferenceLabels ?? [];
  for (const p of prefs.slice(0, 2)) {
    if (!tags.includes(p)) tags.push(p);
  }
  if (tags.length === 0 && prefs.length === 0) {
    // 无元数据时给轻量占位感，不用假标签
  }
  return tags.slice(0, 3);
}

export interface TripListItemProps {
  trip: SavedTrip;
  onPress: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  pinned?: boolean;
  saving?: boolean;
}

function TripCardContent({
  trip,
  onPress,
  onPin,
  onDelete,
  onEdit,
  onClone,
  pinned,
  saving,
}: TripListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const touchDate = trip.updatedAt ?? trip.createdAt;
  const tags = buildTags(trip);
  const tier = budgetTier(trip);
  const companion = trip.insights?.companions;
  const accent = companion ? ACCENT_BY_COMPANION[companion] ?? colors.primary : colors.primary;

  const handleShare = async () => {
    setMenuOpen(false);
    try {
      await Share.share({
        message: `【途灵】${trip.destination} ${trip.daysCount} 天行程${
          trip.budgetEstimate > 0 ? `，预算约 ${trip.budgetEstimate} 元` : ''
        }${trip.travelMonth ? ` · ${trip.travelMonth}` : ''}`,
        title: `${trip.destination}行程`,
      });
    } catch {
      // 用户取消
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.card, saving && styles.savingCard]}
        onPress={onPress}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={`查看 ${trip.destination} 行程`}
        activeOpacity={0.85}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }, pinned && styles.accentBarPinned]} />
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.destination} allowFontScaling numberOfLines={1}>
              {trip.destination}
            </Text>
            {pinned && (
              <View style={styles.pinBadge}>
                <Ionicons name="pin" size={11} color={colors.primaryDark} />
              </View>
            )}
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setMenuOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="更多操作"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.meta} allowFontScaling>
            {trip.daysCount} 天
            {trip.travelMonth ? ` · ${trip.travelMonth}` : ' · 出行时间待定'}
          </Text>
          <View style={styles.budgetRow}>
            <View style={styles.tierChip}>
              <Text style={styles.tierText}>{tier.label}</Text>
            </View>
            <Text style={styles.budgetAmount}>{tier.amount}</Text>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.date}>
              {saving ? '保存中…' : `${formatDate(touchDate)}更新`}
            </Text>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle}>{trip.destination}</Text>
            {onEdit && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                <Ionicons name="create-outline" size={18} color={colors.textStrong} />
                <Text style={styles.menuItemText}>编辑行程</Text>
              </TouchableOpacity>
            )}
            {onClone && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onClone();
                }}
              >
                <Ionicons name="copy-outline" size={18} color={colors.textStrong} />
                <Text style={styles.menuItemText}>复刻同款方案</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={colors.textStrong} />
              <Text style={styles.menuItemText}>分享行程</Text>
            </TouchableOpacity>
            {onPin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onPin();
                }}
              >
                <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={18} color={colors.textStrong} />
                <Text style={styles.menuItemText}>{pinned ? '取消置顶' : '置顶行程'}</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.menuItemText, { color: colors.danger }]}>删除</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function TripListItem(props: TripListItemProps) {
  const { onDelete } = props;
  if (!onDelete) return <TripCardContent {...props} />;

  const renderRight = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity
        style={styles.swipeDelete}
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="左滑删除行程"
      >
        <Animated.Text style={[styles.swipeDeleteText, { transform: [{ scale }] }]}>
          删除
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      <TripCardContent {...props} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadow.soft,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  accentBarPinned: {
    opacity: 1,
    width: 4,
  },
  savingCard: {
    opacity: 0.7,
    borderStyle: 'dashed',
  },
  main: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pinBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  destination: {
    flex: 1,
    fontSize: font.title.size,
    lineHeight: font.title.lineHeight,
    fontWeight: font.title.weight,
    color: colors.textStrong,
  },
  moreBtn: {
    minWidth: MIN_TOUCH - 8,
    minHeight: MIN_TOUCH - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryBg,
  },
  tagText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  meta: {
    fontSize: font.small.size,
    color: colors.textPrimary,
    marginTop: 2,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  tierChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentBg,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDark,
  },
  budgetAmount: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  date: { fontSize: font.tiny.size, color: colors.textMuted },
  swipeDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  swipeDeleteText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: font.body.size,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(50,36,28,0.4)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    ...shadow.soft,
  },
  menuTitle: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: font.small.size,
    fontWeight: '800',
    color: colors.textMuted,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: MIN_TOUCH,
  },
  menuItemText: {
    fontSize: font.body.size,
    fontWeight: '600',
    color: colors.textStrong,
  },
});
