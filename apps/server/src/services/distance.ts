// §5.5 高德距离测量 API：点间通勤真实距离/时间。
const KEY = process.env.AMAP_WEB_KEY;

function formatLabel(distanceM: number, durationS: number, mode: 'walk' | 'drive'): string {
  const km = distanceM / 1000;
  const min = Math.max(1, Math.round(durationS / 60));
  if (mode === 'walk') {
    if (km < 1) return `步行约 ${Math.round(distanceM)}m · ${min} 分钟`;
    return `步行约 ${km.toFixed(1)}km · ${min} 分钟`;
  }
  if (km < 1) return `车程约 ${Math.round(distanceM)}m · ${min} 分钟`;
  return `车程约 ${km.toFixed(1)}km · ${min} 分钟`;
}

/** 高德 v3 距离测量：步行优先，>3km 用驾车估算 */
export async function measureCommute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): Promise<{ distanceM: number; durationS: number; mode: 'walk' | 'drive'; label: string }> {
  if (!KEY) throw new Error('高德未配置（缺 AMAP_WEB_KEY）');

  const origins = `${fromLng},${fromLat}`;
  const destination = `${toLng},${toLat}`;

  async function query(type: 1 | 3) {
    const url =
      `https://restapi.amap.com/v3/distance?key=${KEY}` +
      `&origins=${origins}&destination=${destination}&type=${type}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      results?: { distance: string; duration: string }[];
    };
    if (data.status !== '1' || !data.results?.[0]) {
      throw new Error('高德距离查询失败');
    }
    const r = data.results[0];
    return {
      distanceM: Number(r.distance) || 0,
      durationS: Number(r.duration) || 0,
    };
  }

  const walk = await query(1);
  if (walk.distanceM <= 3000) {
    return { ...walk, mode: 'walk', label: formatLabel(walk.distanceM, walk.durationS, 'walk') };
  }
  const drive = await query(3);
  return { ...drive, mode: 'drive', label: formatLabel(drive.distanceM, drive.durationS, 'drive') };
}
