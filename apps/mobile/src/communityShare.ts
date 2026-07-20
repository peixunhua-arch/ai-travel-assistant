import type { CommunityTripSnapshot, SavedTrip } from '@travel/shared';

/** 从本地行程生成社区分享快照 */
export function buildTripSnapshot(trip: SavedTrip): CommunityTripSnapshot {
  const highlightItems = trip.days
    .flatMap((d) => d.items)
    .filter((i) => i.type !== 'transport')
    .slice(0, 6)
    .map((i) => ({
      name: i.name,
      type: i.type,
      photoUrl: i.photoUrl,
    }));

  return {
    destination: trip.destination,
    daysCount: trip.daysCount,
    budgetEstimate: trip.budgetEstimate,
    highlightItems,
  };
}

export function defaultTripPostTitle(trip: SavedTrip): string {
  return `${trip.destination} ${trip.daysCount} 日游`;
}

export function defaultTripPostBody(trip: SavedTrip): string {
  const themes = trip.days.map((d) => d.theme).filter(Boolean).slice(0, 3);
  const themeText = themes.length ? `主题：${themes.join('、')}。` : '';
  return `分享我的 ${trip.destination} 行程，${trip.daysCount} 天，预算约 ${trip.budgetEstimate > 0 ? `${trip.budgetEstimate} 元` : '不限'}。${themeText}`;
}
