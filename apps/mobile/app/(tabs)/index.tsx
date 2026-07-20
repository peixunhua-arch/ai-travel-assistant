// 「规划行程」Tab（底部第一个页签）：结构化行程生成表单。
// AI 聊聊从顶栏进入；首次轻引导由根布局弹出。
import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { FadeInView } from '../../src/components/FadeInView';
import { TripGenerateForm } from '../../src/components/TripGenerateForm';
import {
  setDraftTrip,
  getDraftTrip,
  getPreviewDraft,
  clearPreviewDraft,
} from '../../src/tripStore';
import type { TripGenerateRequest } from '@travel/shared';
import { colors, spacing, font, radius, shadow } from '../../src/theme';
import { tapLight } from '../../src/haptics';
import { useNetworkStatus } from '../../src/network';

export default function PlanTab() {
  const router = useRouter();
  const network = useNetworkStatus();
  const [formSeed, setFormSeed] = useState(0);
  const lastDraftKey = useRef<string>('');

  // 从聊天 / 首次引导带入草稿时刷新表单
  useFocusEffect(
    useCallback(() => {
      const draft = getDraftTrip();
      const key = draft?.params ? JSON.stringify(draft.params) : '';
      if (key && key !== lastDraftKey.current) {
        lastDraftKey.current = key;
        setFormSeed((n) => n + 1);
      }
    }, []),
  );

  // 未保存预览草稿恢复（UX §5.6）
  useFocusEffect(
    useCallback(() => {
      getPreviewDraft().then((draft) => {
        if (!draft) return;
        Alert.alert(
          '发现未保存的行程',
          `有一份「${draft.trip.destination}」${draft.trip.daysCount} 天的行程还没保存，要恢复吗？`,
          [
            {
              text: '忽略',
              style: 'cancel',
              onPress: () => clearPreviewDraft(),
            },
            {
              text: '恢复',
              onPress: () => {
                setDraftTrip(draft.trip, draft.params);
                router.push('/trip/preview');
              },
            },
          ],
        );
      });
    }, [router]),
  );

  const handleFormSubmit = (params: TripGenerateRequest) => {
    if (network === 'offline') {
      Alert.alert('无法生成', '生成行程需要联网，请检查 WiFi 后重试');
      return;
    }
    if (network === 'weak') {
      Alert.alert(
        '网络较慢',
        '当前使用移动网络，生成行程约需 1 分钟，建议连接 WiFi。仍要继续吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '继续生成', onPress: () => goPreview(params) },
        ],
      );
      return;
    }
    goPreview(params);
  };

  const goPreview = (params: TripGenerateRequest) => {
    tapLight();
    setDraftTrip(null, params);
    router.push('/trip/preview');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.title}>规划行程</Text>
        </View>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => {
            tapLight();
            router.navigate('/(tabs)/chat');
          }}
          accessibilityRole="button"
          accessibilityLabel="打开 AI 聊天"
        >
          <Text style={styles.chatBtnText}>AI 聊聊</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <FadeInView key={`plan-${formSeed}`} style={styles.flex}>
          <TripGenerateForm initialValues={getDraftTrip()?.params} onSubmit={handleFormSubmit} />
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
  chatBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  chatBtnText: {
    fontSize: font.small.size,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  body: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
