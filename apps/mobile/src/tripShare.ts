// 行程分享文本格式化（UX §8.3）。
import type { SavedTrip, TripGenerateResponse } from '@travel/shared';
import { TRIP_TYPE_META } from './tripTypes';

const DISCLAIMER =
  '—— 行程由 AI 生成，仅供参考，请以实际营业时间与价格为准。';

type ShareableTrip = Pick<
  SavedTrip | TripGenerateResponse,
  'destination' | 'daysCount' | 'budgetEstimate' | 'days'
>;

export function formatTripForShare(trip: ShareableTrip): string {
  const budget =
    trip.budgetEstimate > 0 ? `预算约 ${trip.budgetEstimate} 元` : '预算不限';
  const lines: string[] = [
    `🧳 ${trip.destination} · ${trip.daysCount} 天 · ${budget}`,
    '',
  ];

  for (const day of trip.days) {
    lines.push(`【第 ${day.day} 天 · ${day.theme}】`);
    for (const item of day.items) {
      const meta = TRIP_TYPE_META[item.type];
      lines.push(`${item.time} ${meta.emoji} ${item.name}`);
      if (item.address) lines.push(`   📍 ${item.address}`);
      lines.push(`   ${item.description}`);
    }
    lines.push('');
  }

  lines.push(DISCLAIMER);
  return lines.join('\n');
}
