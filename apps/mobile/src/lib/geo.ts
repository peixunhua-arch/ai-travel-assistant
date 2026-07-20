// 点间距离估算（Haversine）。无高德距离 API 时用坐标粗算通勤提示。

const EARTH_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 两点球面距离（公里） */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 格式化为用户可读的通勤文案 */
export function formatCommuteHint(km: number): string {
  if (km < 0.3) return '步行约 5 分钟';
  if (km < 1.2) return `步行约 ${Math.round(km * 12)} 分钟`;
  if (km < 3) return `约 ${Math.round(km * 15)} 分钟车程`;
  return `约 ${Math.round(km * 3)} 分钟车程`;
}
