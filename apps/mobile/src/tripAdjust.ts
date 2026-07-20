// §8.2 多轮规划：把已保存行程摘要塞进 prompt，供「在此基础上调整 / 重新生成」。
import type { SavedTrip, TripGenerateRequest, TripGenerateResponse } from '@travel/shared';

function summarizeDays(trip: SavedTrip): string {
  return trip.days
    .map((d) => {
      const names = d.items
        .filter((i) => i.type !== 'transport')
        .map((i) => i.name)
        .join('、');
      return `第${d.day}天（${d.theme}）：${names || '（无安排）'}`;
    })
    .join('\n');
}

/** 生成「在此基础上微调」的 prompt 前缀 */
export function buildRefinePrompt(trip: SavedTrip, userNote?: string): string {
  const base =
    '【在以下已有行程基础上调整，保留大体框架，按我的补充要求修改】\n' +
    summarizeDays(trip);
  const note = userNote?.trim();
  return note ? `${base}\n\n调整方向：${note}` : `${base}\n\n调整方向：`;
}

/** 生成「重新规划某一天」的 prompt */
export function buildRegenerateDayPrompt(trip: SavedTrip | TripGenerateResponse, dayNum: number): string {
  const summary = 'days' in trip && Array.isArray(trip.days)
    ? trip.days
        .map((d) => {
          const names = d.items
            .filter((i) => i.type !== 'transport')
            .map((i) => i.name)
            .join('、');
          return `第${d.day}天（${d.theme}）：${names || '（无安排）'}`;
        })
        .join('\n')
    : '';
  return (
    `【以下行程中，第 ${dayNum} 天安排过少，请重点重新规划第 ${dayNum} 天，其它天可保持类似或略作优化】\n` +
    summary
  );
}

/** 生成「重新规划类似行程」的 prompt */
export function buildRegeneratePrompt(trip: SavedTrip): string {
  return (
    '【参考以下已有行程，请重新规划一份新的类似行程，可优化顺序与推荐】\n' +
    summarizeDays(trip)
  );
}

export function savedTripToParams(
  trip: SavedTrip,
  prompt: string,
): TripGenerateRequest {
  const budget =
    trip.insights?.userBudget !== undefined
      ? trip.insights.userBudget
      : trip.budgetEstimate > 0
        ? trip.budgetEstimate
        : 0;
  return {
    destination: trip.destination,
    days: trip.daysCount,
    budget,
    preferences: trip.insights?.preferenceLabels ?? [],
    prompt,
    travelMonth: trip.travelMonth,
    companions: trip.insights?.companions,
    pace: trip.insights?.pace,
    previousTripId: trip.serverTripId,
  };
}

/** 复刻同款：带上原行程参数，方便微调后重新生成 */
export function cloneTripParams(trip: SavedTrip): TripGenerateRequest {
  return savedTripToParams(
    trip,
    `【复刻「${trip.destination}」行程】可在此基础上微调天数、预算或偏好后重新生成`,
  );
}
