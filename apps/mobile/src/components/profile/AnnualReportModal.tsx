// 年度出行报告（本地行程汇总，轻量 AI 口吻总结）。
import { Modal, View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native';
import type { SavedTrip } from '@travel/shared';
import { buildAnnualReportSummary } from '../../lib/travelPortrait';
import { colors, spacing, radius, font } from '../../theme';
import { tapSuccess } from '../../haptics';

interface Props {
  visible: boolean;
  trips: SavedTrip[];
  displayName: string;
  onClose: () => void;
}

export function AnnualReportModal({ visible, trips, displayName, onClose }: Props) {
  const year = new Date().getFullYear();
  const summary = buildAnnualReportSummary(trips);

  const share = async () => {
    const text = [
      `【${displayName} 的 ${year} 途灵旅行报告】`,
      `出行 ${summary.tripCount} 次 · 共 ${summary.totalDays} 天`,
      summary.cities.length ? `打卡城市：${summary.cities.join('、')}` : '还没有城市打卡',
      summary.prefs.length ? `偏好关键词：${summary.prefs.join('、')}` : '',
      `节奏印象：${summary.paceHint}`,
      '—— 由途灵 AI 根据你的行程汇总',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await Share.share({ message: text, title: `${year} 旅行报告` });
      tapSuccess();
    } catch {
      // 取消
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{year} 出行年报</Text>
          <Text style={styles.title}>{displayName} 的旅行记忆</Text>
          <Text style={styles.lead}>途灵根据你保存的行程，整理出一份轻盈小结</Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.num}>{summary.tripCount}</Text>
              <Text style={styles.label}>行程</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.num}>{summary.cities.length}</Text>
              <Text style={styles.label}>城市</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.num}>{summary.totalDays}</Text>
              <Text style={styles.label}>天数</Text>
            </View>
          </View>

          {summary.cities.length > 0 ? (
            <Text style={styles.block}>
              <Text style={styles.blockKey}>打卡足迹 </Text>
              {summary.cities.join(' · ')}
            </Text>
          ) : (
            <Text style={styles.blockMuted}>还没有行程，去规划一次就有足迹了</Text>
          )}

          {summary.prefs.length > 0 ? (
            <Text style={styles.block}>
              <Text style={styles.blockKey}>口味画像 </Text>
              {summary.prefs.join('、')}
            </Text>
          ) : null}

          <Text style={styles.block}>
            <Text style={styles.blockKey}>节奏印象 </Text>
            {summary.paceHint}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondary} onPress={onClose}>
              <Text style={styles.secondaryText}>关闭</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={share}>
              <Text style={styles.primaryText}>保存分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(60,40,30,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textStrong,
  },
  lead: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 4,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  num: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  label: { fontSize: 11, color: colors.textMuted },
  block: {
    fontSize: font.small.size,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  blockKey: { fontWeight: '800', color: colors.textStrong },
  blockMuted: {
    fontSize: font.small.size,
    color: colors.textMuted,
    lineHeight: 20,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  secondaryText: { fontWeight: '700', color: colors.textMuted },
  primary: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  primaryText: { fontWeight: '800', color: colors.textOnPrimary },
});
