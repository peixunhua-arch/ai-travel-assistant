// §3.2 内联错误条 + 重试
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../theme';

export function ErrorBanner({
  message,
  actionLabel = '点按重试',
  onRetry,
}: {
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onRetry}
      disabled={!onRetry}
      accessibilityRole="button"
      accessibilityLabel={`${message}，${actionLabel}`}
    >
      <Text style={styles.msg}>⚠️ {message}</Text>
      {onRetry ? <Text style={styles.action}>{actionLabel}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  msg: { color: colors.danger, fontSize: font.tiny.size, flexShrink: 1 },
  action: {
    color: colors.primary,
    fontSize: font.tiny.size,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
