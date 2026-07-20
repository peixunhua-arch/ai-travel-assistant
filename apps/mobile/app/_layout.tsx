// 根布局：隐私同意 → 全屏产品介绍 → 规划轻引导弹窗 → 主界面。
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, SplashScreen, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingSlides, ONBOARDING_KEY } from '../src/components/OnboardingSlides';
import {
  FirstPlanGuide,
  shouldShowFirstPlanGuide,
} from '../src/components/FirstPlanGuide';
import { PrivacyConsent, PRIVACY_KEY } from '../src/components/PrivacyConsent';
import { ElderModeProvider } from '../src/lib/elderMode';
import { ToastProvider } from '../src/components/Toast';
import { ThemeProvider } from '../src/lib/themeMode';
import { ExternalLinkHost } from '../src/components/ExternalLinkModal';
import { setDraftTrip } from '../src/tripStore';
import type { TripGenerateRequest } from '@travel/shared';
import { pushRecentDestination } from '../src/recentDestinations';
import { loadApiBaseUrl } from '../src/apiBase';

// 冷启动默认进入 Tab，避免 exp://.../--/ 无匹配路由。
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [privacyOk, setPrivacyOk] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [showPlanGuide, setShowPlanGuide] = useState(false);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    loadApiBaseUrl().finally(() => setApiReady(true));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_KEY).then((v) => setPrivacyOk(v === '1'));
  }, []);

  useEffect(() => {
    if (privacyOk !== true) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then((seen) => {
      setShowOnboarding(seen !== '1');
    });
  }, [privacyOk]);

  // 产品介绍结束后（或老用户已看过介绍），按需弹出「想去哪儿玩」轻引导
  useEffect(() => {
    if (privacyOk !== true || showOnboarding !== false) return;
    shouldShowFirstPlanGuide().then(setShowPlanGuide);
  }, [privacyOk, showOnboarding]);

  // 初始化完成后再隐藏启动页，避免闪白屏。
  useEffect(() => {
    if (!apiReady || privacyOk === null) return;
    if (privacyOk === false) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    if (showOnboarding !== null) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [apiReady, privacyOk, showOnboarding]);

  const handleGuideGenerate = async (params: TripGenerateRequest) => {
    await pushRecentDestination(params.destination);
    setDraftTrip(null, params);
    setShowPlanGuide(false);
    try {
      router.push('/trip/preview');
    } catch {
      Alert.alert('', '已准备好行程参数，请到「规划行程」继续生成');
    }
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
      <ElderModeProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <ExternalLinkHost />

          {privacyOk === false && <PrivacyConsent onAccept={() => setPrivacyOk(true)} />}
          {privacyOk === true && showOnboarding === true && (
            <OnboardingSlides onDone={() => setShowOnboarding(false)} />
          )}
          {privacyOk === true && showOnboarding === false && (
            <FirstPlanGuide
              visible={showPlanGuide}
              onDismiss={() => setShowPlanGuide(false)}
              onGenerate={handleGuideGenerate}
            />
          )}
        </ToastProvider>
      </ElderModeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
