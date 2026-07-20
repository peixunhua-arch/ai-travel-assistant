// 行程 Stack：预览页 + 详情页
import { Stack } from 'expo-router';

export default function TripLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
