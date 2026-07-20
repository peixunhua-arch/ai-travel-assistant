// 「AI 聊天」Tab：底部中间加号入口。
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { FadeInView } from '../../src/components/FadeInView';
import { setDraftTrip } from '../../src/tripStore';
import type { TripGenerateRequest } from '@travel/shared';
import { colors, spacing, font, radius, shadow } from '../../src/theme';
import { clearChatMessages } from '../../src/chatStore';
import { tapLight } from '../../src/haptics';
import { parseTripIntent } from '../../src/lib/parseTripIntent';

export default function ChatTab() {
  const router = useRouter();
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    tapLight();
    Alert.alert('开始新对话？', '当前对话内容会清空，确定吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '新对话',
        style: 'destructive',
        onPress: () => {
          clearChatMessages();
          setChatKey((k) => k + 1);
        },
      },
    ]);
  };

  /** 聊天 → 规划表单：预填参数并跳到「规划行程」Tab */
  const handlePlanFromChat = (params: TripGenerateRequest) => {
    tapLight();
    const normalized =
      params.destination.trim().length > 0
        ? params
        : parseTripIntent(params.prompt ?? '') ?? params;
    setDraftTrip(null, {
      destination: normalized.destination || '',
      days: normalized.days || 3,
      budget: normalized.budget ?? 0,
      preferences: normalized.preferences ?? [],
      prompt: normalized.prompt,
      travelMonth: normalized.travelMonth,
      companions: normalized.companions,
      pace: normalized.pace,
      departureCity: normalized.departureCity,
    });
    router.navigate('/(tabs)/');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.title}>途灵</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={handleNewChat}
          accessibilityRole="button"
          accessibilityLabel="开始新对话"
        >
          <Text style={styles.newChat}>新对话</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <FadeInView key={`chat-${chatKey}`} style={styles.flex}>
          <ChatScreen key={chatKey} onPlanTrip={handlePlanFromChat} />
        </FadeInView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    ...shadow.soft,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: font.display.size,
    lineHeight: font.display.lineHeight,
    fontWeight: font.display.weight,
    color: colors.textStrong,
  },
  newChatBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  newChat: { fontSize: font.small.size, color: colors.primaryDark, fontWeight: '700' },
  body: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
