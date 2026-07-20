// §8.3 行程分享：文本 + 长图。
import { Alert, Share, View } from 'react-native';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { SavedTrip, TripGenerateResponse } from '@travel/shared';
import { formatTripForShare } from './tripShare';

type ShareableTrip = Pick<
  SavedTrip | TripGenerateResponse,
  'destination' | 'daysCount' | 'budgetEstimate' | 'days'
>;

export async function shareTripText(trip: ShareableTrip): Promise<void> {
  try {
    await Share.share({
      message: formatTripForShare(trip),
      title: `${trip.destination} · ${trip.daysCount}天行程`,
    });
  } catch {
    // 用户取消
  }
}

export async function shareTripLongImage(
  cardRef: RefObject<View | null>,
): Promise<void> {
  if (!cardRef.current) {
    Alert.alert('', '分享卡片未就绪，请稍后再试');
    return;
  }
  try {
    const uri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '分享行程长图' });
    } else {
      await Share.share({ url: uri, message: '我的行程' });
    }
  } catch (e) {
    Alert.alert('分享失败', e instanceof Error ? e.message : '无法生成长图');
  }
}

export function showTripShareOptions(
  trip: ShareableTrip,
  cardRef: RefObject<View | null>,
): void {
  Alert.alert('分享行程', '选择分享方式', [
    { text: '取消', style: 'cancel' },
    { text: '分享文本', onPress: () => shareTripText(trip) },
    { text: '分享长图', onPress: () => shareTripLongImage(cardRef) },
  ]);
}
