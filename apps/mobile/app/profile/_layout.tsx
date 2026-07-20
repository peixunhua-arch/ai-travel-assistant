import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { fontWeight: '700', color: colors.textStrong },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="luggage" options={{ title: '行李清单' }} />
      <Stack.Screen name="documents" options={{ title: '证件备忘' }} />
      <Stack.Screen name="help" options={{ title: '客服与帮助' }} />
    </Stack>
  );
}
