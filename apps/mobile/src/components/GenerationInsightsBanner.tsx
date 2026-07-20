// 生成结果可解释横幅：偏好 / 个性化 / 天气 / 质量警告一处说清。
import { View, Text, StyleSheet } from 'react-native';
import type { TripInsights, TripWarnings } from '@travel/shared';
import { TripWarningsBanner } from './TripWarningsBanner';
import { colors, spacing, radius, font } from '../theme';

type Props = {
  insights?: TripInsights | null;
  warnings?: TripWarnings;
  personalized?: boolean;
  preferenceLabels?: string[];
  usedWeather?: boolean;
  userBudget?: number;
  budgetEstimate?: number;
};

export function GenerationInsightsBanner({
  insights,
  warnings,
  personalized,
  preferenceLabels,
  usedWeather,
  userBudget,
  budgetEstimate,
}: Props) {
  const prefs = preferenceLabels ?? insights?.preferenceLabels ?? [];
  const isPersonalized = personalized ?? insights?.personalized ?? false;
  const hasWeather = usedWeather ?? insights?.usedWeather ?? false;
  const warn = warnings ?? insights?.warnings;
  const budget = userBudget ?? insights?.userBudget ?? 0;
  const estimate = budgetEstimate ?? 0;

  const lines: string[] = [];
  if (isPersonalized) {
    lines.push('已参考你过往评价与偏好，调整了推荐倾向');
  }
  if (prefs.length > 0) {
    lines.push(`按你勾选的偏好：${prefs.join('、')}`);
  }
  if (hasWeather) {
    lines.push('已参考目的地近几日天气预报安排户外时间');
  }
  if (budget > 0 && estimate > 0) {
    lines.push(
      estimate > budget
        ? `预估约 ${estimate} 元，可能略超你设的 ${budget} 元预算`
        : `预估约 ${estimate} 元，在你设的 ${budget} 元预算内`,
    );
  }

  if (lines.length === 0 && !warn) return null;

  return (
    <View style={styles.wrap}>
      {lines.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>本次行程怎么来的</Text>
          {lines.map((line) => (
            <Text key={line} style={styles.line}>
              · {line}
            </Text>
          ))}
        </View>
      )}
      {warn ? <TripWarningsBanner warnings={warn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  card: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  title: {
    fontSize: font.small.size,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  line: {
    fontSize: font.tiny.size,
    lineHeight: font.tiny.lineHeight,
    color: colors.primaryDark,
  },
});
