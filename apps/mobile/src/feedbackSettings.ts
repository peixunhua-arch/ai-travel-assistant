// §16.5 反馈感官层：可选增强反馈（默认关，开启后成功操作双重触觉）
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapLight, tapSuccess } from './haptics';

const KEY = 'feedbackSoundEnabled';

export async function isSoundEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}

/** 增强成功反馈（开启时双重触觉，模拟「音效+震动」） */
export async function playEnhancedSuccess(): Promise<void> {
  if (!(await isSoundEnabled())) return;
  tapSuccess();
  setTimeout(() => tapLight(), 120);
}
