// 出行客服帮助 + 意见反馈入口。
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapLight } from '../../src/haptics';

const FAQS = [
  {
    q: '行程保存在哪里？',
    a: '主要保存在本机；保存成功时会同步一份到云端，换机可在「我的」里从云端恢复。',
  },
  {
    q: 'AI 生成准吗？',
    a: '行程由 AI 结合地点与偏好生成，仅供参考。营业时间、票价请自行再确认。',
  },
  {
    q: '如何让推荐更懂我？',
    a: '在「旅行画像」编辑偏好，并对行程多做评价，下次规划会更贴合口味。',
  },
];

export default function HelpScreen() {
  const router = useRouter();

  const feedback = () => {
    tapLight();
    const url = 'mailto:hello@tuling.app?subject=途灵意见反馈';
    Linking.openURL(url).catch(() => {
      Alert.alert('意见反馈', '请将问题发送至 hello@tuling.app，我们会尽快查看。');
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.primary}
        onPress={() => {
          tapLight();
          router.push('/(tabs)/chat');
        }}
      >
        <Ionicons name="chatbubbles-outline" size={22} color={colors.textOnPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.primaryTitle}>问问途灵 AI</Text>
          <Text style={styles.primarySub}>行程规划、签证天气等问题都可以聊</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textOnPrimary} />
      </TouchableOpacity>

      <Text style={styles.section}>常见问题</Text>
      <View style={styles.card}>
        {FAQS.map((f, i) => (
          <View key={f.q} style={[styles.faq, i < FAQS.length - 1 && styles.faqBorder]}>
            <Text style={styles.q}>{f.q}</Text>
            <Text style={styles.a}>{f.a}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.secondary} onPress={feedback}>
        <Ionicons name="mail-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.secondaryText}>意见反馈</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  primaryTitle: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 },
  primarySub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  section: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  faq: { padding: spacing.md, gap: 4 },
  faqBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  q: { fontWeight: '700', color: colors.textStrong, fontSize: font.small.size },
  a: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  secondaryText: { fontWeight: '700', color: colors.primaryDark, fontSize: 14 },
});
