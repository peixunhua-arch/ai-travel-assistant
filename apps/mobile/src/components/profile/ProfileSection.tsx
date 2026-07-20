// 「我的」页分区：支持名片感 soft / 轻列表 compact / 传统 card。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

type Tone = 'soft' | 'compact' | 'card';

export function ProfileSection({
  title,
  children,
  tone = 'soft',
}: {
  title?: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  if (tone === 'soft') {
    return (
      <View style={styles.softWrap}>
        {title ? <Text style={styles.softTitle}>{title}</Text> : null}
        {children}
      </View>
    );
  }

  if (tone === 'compact') {
    return (
      <View style={styles.compactWrap}>
        {title ? <Text style={styles.compactTitle}>{title}</Text> : null}
        <View style={styles.compactBody}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.cardWrap}>
      {title ? (
        <View style={styles.cardTitleBar}>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  softWrap: {
    gap: 10,
  },
  softTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textStrong,
    marginLeft: 2,
  },
  compactWrap: { gap: 8 },
  compactTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 4,
  },
  compactBody: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  cardWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  cardTitleBar: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  cardBody: { overflow: 'hidden' },
});
