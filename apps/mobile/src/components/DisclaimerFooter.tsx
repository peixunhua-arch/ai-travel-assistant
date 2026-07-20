// AI 免责声明底栏（UX §10）：行程页/预览页复用。
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export function DisclaimerFooter() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        行程由 AI 生成，仅供参考，请以实际营业时间与价格为准。地点数据来自高德 POI。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warningBorder,
    padding: spacing.md,
  },
  text: {
    fontSize: font.small.size,
    lineHeight: font.small.lineHeight,
    color: colors.warningText,
  },
});
