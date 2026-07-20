// 行程条目「类型」的展示配方：每种 type 对应一个 emoji、一个中文标签、一个点缀色。
// 单独抽出来，是为了让所有相关组件（卡片、图例等）都引这一处——改一次，处处一致。
import type { TripItem } from '@travel/shared';
import { colors } from './theme';

// TripItem['type'] 就是 'sight' | 'food' | 'hotel' | 'transport'，从共享类型取，别再手抄一遍。
type TripType = TripItem['type'];

export const TRIP_TYPE_META: Record<TripType, { emoji: string; label: string; color: string }> = {
  sight: { emoji: '🏛️', label: '景点', color: colors.primary },
  food: { emoji: '🍜', label: '餐饮', color: colors.accentFood },
  hotel: { emoji: '🏨', label: '住宿', color: colors.accentHotel },
  transport: { emoji: '🚗', label: '交通', color: colors.textMuted },
};
