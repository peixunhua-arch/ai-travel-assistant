// 未知路径兜底：回到主 Tab，避免 Expo Go 显示 Unmatched Route。
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/(tabs)" />;
}
