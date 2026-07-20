// §16.3 朗读行程：用系统 TTS 把当天安排念出来（长辈模式友好）。
import * as Speech from 'expo-speech';
import type { TripDay } from '@travel/shared';

const TYPE_LABEL: Record<string, string> = {
  sight: '景点',
  food: '美食',
  hotel: '住宿',
  transport: '交通',
};

function buildDayScript(day: TripDay, destination: string): string {
  const items = day.items
    .map((item) => {
      const kind = TYPE_LABEL[item.type] ?? '';
      const desc = item.description?.trim();
      return `${item.time}，${kind}${item.name}${desc ? `，${desc}` : ''}`;
    })
    .join('。');
  return `${destination}，第 ${day.day} 天，${day.theme}。${items || '暂无具体安排'}`;
}

export async function getSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}

/** 朗读某一天行程；已在朗读时先停止再播新的 */
export async function speakTripDay(
  day: TripDay,
  destination: string,
  options?: { rate?: number },
): Promise<void> {
  await Speech.stop();
  const text = buildDayScript(day, destination);
  Speech.speak(text, {
    language: 'zh-CN',
    rate: options?.rate ?? 0.92,
    pitch: 1.0,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
