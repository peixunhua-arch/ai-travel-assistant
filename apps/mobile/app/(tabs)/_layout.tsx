// 底部 Tab：规划行程 / 行程 / ＋(快速短途) / 社区 / 我的。
// 中间加号打开「快速短途规划」弹窗；AI 聊天从「规划行程」顶栏进入。
import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Platform, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../../src/lib/themeMode';
import { HealthBanner } from '../../src/components/HealthBanner';
import { QuickShortTripModal } from '../../src/components/QuickShortTripModal';
import { setDraftTrip } from '../../src/tripStore';
import type { TripGenerateRequest } from '@travel/shared';
import { shadow, radius } from '../../src/theme';
import { t } from '../../src/lib/i18n';
import { tapLight } from '../../src/haptics';
import { useNetworkStatus } from '../../src/network';
import { pushRecentDestination } from '../../src/recentDestinations';

type IconName = ComponentProps<typeof Ionicons>['name'];
type AppColors = ReturnType<typeof useAppTheme>['colors'];

function TabIcon({
  focused,
  color,
  outline,
  filled,
}: {
  focused: boolean;
  color: string;
  outline: IconName;
  filled: IconName;
}) {
  return <Ionicons name={focused ? filled : outline} size={22} color={color} />;
}

function CenterPlusButton({
  colors,
  onPressQuick,
}: {
  colors: AppColors;
  onPressQuick: () => void;
} & Partial<BottomTabBarButtonProps>) {
  return (
    <Pressable
      onPress={() => {
        tapLight();
        onPressQuick();
      }}
      accessibilityRole="button"
      accessibilityLabel="快速短途规划"
      style={styles.plusSlot}
    >
      <View
        style={[
          styles.plusBox,
          {
            borderColor: colors.primary,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.primaryDark} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const network = useNetworkStatus();
  const [quickOpen, setQuickOpen] = useState(false);

  const goPreview = async (params: TripGenerateRequest) => {
    if (network === 'offline') {
      Alert.alert('无法生成', '生成行程需要联网，请检查 WiFi 后重试');
      return;
    }
    await pushRecentDestination(params.destination);
    setDraftTrip(null, params);
    router.push('/trip/preview');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <HealthBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: 4,
            height: Platform.OS === 'ios' ? 84 : 64,
            ...shadow.soft,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: Platform.OS === 'ios' ? 0 : 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.plan', '规划行程'),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} outline="map-outline" filled="map" />
            ),
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: t('tab.trips', '行程'),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                outline="calendar-outline"
                filled="calendar"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: t('tab.chat', 'AI聊天'),
            tabBarLabel: () => null,
            tabBarIcon: () => null,
            tabBarButton: () => (
              <CenterPlusButton colors={colors} onPressQuick={() => setQuickOpen(true)} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setQuickOpen(true);
            },
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: t('tab.community', '社区'),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} outline="people-outline" filled="people" />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tab.profile', '我的'),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} outline="person-outline" filled="person" />
            ),
          }}
        />
      </Tabs>

      <QuickShortTripModal
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSubmit={goPreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plusSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -6,
  },
  plusBox: {
    width: 44,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
