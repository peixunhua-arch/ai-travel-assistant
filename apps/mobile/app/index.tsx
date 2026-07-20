// 根入口：Expo Go 打开 exp://.../--/ 时重定向到主 Tab，避免 Unmatched Route。
import { Redirect } from 'expo-router';

export default function RootIndex() {
  return <Redirect href="/(tabs)/" />;
}
