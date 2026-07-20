// 旅行画像主角区：水彩标签云 + 实心完善按钮。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { UserPreferences } from '@travel/shared';
import type { TravelPortrait } from '../../lib/travelPortrait';
import { companionLabel } from '../../lib/travelPortrait';
import { colors, spacing } from '../../theme';
import { tapLight } from '../../haptics';

const CHIP_PALETTE = [
  { bg: '#FCE8E8', fg: '#C0392B' }, // 朱砂
  { bg: '#FBF3E0', fg: '#B8882E' }, // 鎏金
  { bg: '#E8F5EE', fg: '#2D8B5B' }, // 竹绿
  { bg: '#E8EDF5', fg: '#4A5D8C' }, // 青黛
  { bg: '#FCEAF0', fg: '#C85A7A' }, // 胭脂
  { bg: '#FBF0E8', fg: '#C8804A' }, // 赭石
];

function Tag({ label, index }: { label: string; index: number }) {
  const pal = CHIP_PALETTE[index % CHIP_PALETTE.length];
  return (
    <View style={[styles.tag, { backgroundColor: pal.bg }]}>
      <Text style={[styles.tagText, { color: pal.fg }]}>{label}</Text>
    </View>
  );
}

interface Props {
  portrait: TravelPortrait;
  reviewPrefs: UserPreferences | null;
  inferredCompanionLabel?: string;
  onEdit: () => void;
}

export function TravelPortraitCard({
  portrait,
  reviewPrefs,
  inferredCompanionLabel,
  onEdit,
}: Props) {
  const liked = reviewPrefs?.liked ?? [];
  const prefs = [...new Set([...portrait.preferences, ...liked])].slice(0, 10);
  const companion = companionLabel(portrait.companions) ?? inferredCompanionLabel;
  const empty = prefs.length === 0 && !companion;

  return (
    <View style={styles.wrap}>
      <Text style={styles.narrative}>途灵会按你的口味，自动定制更合拍的行程</Text>

      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🧳</Text>
          <Text style={styles.emptyTitle}>你的旅行味道还没写上</Text>
          <Text style={styles.emptySub}>点下面告诉我爱吃什么、喜欢跟谁走</Text>
        </View>
      ) : (
        <View style={styles.tags}>
          {companion ? <Tag label={companion} index={0} /> : null}
          {prefs.map((p, i) => (
            <Tag key={p} label={p} index={i + 1} />
          ))}
        </View>
      )}

      {(reviewPrefs?.disliked?.length ?? 0) > 0 ? (
        <Text style={styles.avoid} numberOfLines={1}>
          避雷 {reviewPrefs!.disliked.join('、')}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          tapLight();
          onEdit();
        }}
        accessibilityRole="button"
        accessibilityLabel="完善画像"
      >
        <Text style={styles.ctaText}>{empty ? '完善我的旅行画像' : '完善画像'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,210,197,0.55)',
  },
  narrative: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: '500',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  emptyEmoji: { fontSize: 28, marginBottom: 2 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textStrong,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  avoid: {
    fontSize: 11,
    color: colors.textPlaceholder,
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textOnPrimary,
  },
});
