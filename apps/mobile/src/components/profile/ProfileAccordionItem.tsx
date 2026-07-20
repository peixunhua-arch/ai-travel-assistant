// 「我的」页可折叠说明项。
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../../theme';
import { MIN_TOUCH } from '../../lib/a11y';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  last?: boolean;
}

export function ProfileAccordionItem({ title, children, defaultOpen, last }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <View style={!last ? styles.border : undefined}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: MIN_TOUCH,
  },
  title: {
    fontSize: font.small.size,
    fontWeight: '600',
    color: colors.textStrong,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
