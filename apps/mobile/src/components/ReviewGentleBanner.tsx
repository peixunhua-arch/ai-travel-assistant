// §7.1 评价轻提示：浏览行程一段时间后温和提醒，不弹窗打断。
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export function ReviewGentleBanner({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>体验后点个评价，下次推荐会更准 ✨</Text>
      <TouchableOpacity onPress={onDismiss} accessibilityLabel="关闭提示">
        <Text style={styles.dismiss}>知道了</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
  },
  text: {
    flex: 1,
    fontSize: font.small.size,
    color: colors.textPrimary,
    lineHeight: font.small.lineHeight,
  },
  dismiss: {
    fontSize: font.small.size,
    color: colors.primary,
    fontWeight: '700',
  },
});
