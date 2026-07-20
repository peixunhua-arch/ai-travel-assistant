// 行程地图（阶段 3 + §5.2 联动）：WebView 高德 JS，标点连线，支持高亮与点击回传。
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { TripItem } from '@travel/shared';
import { AMAP_JS_KEY, AMAP_JS_SECURITY } from '../config';
import { radius, colors, spacing, font } from '../theme';

interface MapPoint {
  lng: number;
  lat: number;
  name: string;
  time: string;
  index: number;
}

export function TripMap({
  items,
  offline,
  height = 260,
  selectedIndex = null,
  onSelectIndex,
}: {
  items: TripItem[];
  offline?: boolean;
  height?: number;
  selectedIndex?: number | null;
  onSelectIndex?: (index: number) => void;
}) {
  const points: MapPoint[] = useMemo(() => {
    let idx = 0;
    return items
      .filter((it) => it.type !== 'transport')
      .filter((it) => typeof it.lat === 'number' && typeof it.lng === 'number')
      .map((it) => ({
        lng: it.lng as number,
        lat: it.lat as number,
        name: it.name,
        time: it.time,
        index: idx++,
      }));
  }, [items]);

  const html = useMemo(() => {
    if (!AMAP_JS_KEY || points.length === 0) return '';
    const pointsJson = JSON.stringify(points);
    const hi = selectedIndex ?? -1;
    const mapPrimary = colors.primary;
    const mapMuted = colors.textPrimary;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="initial-scale=1.0, user-scalable=no" />
  <style>html,body,#map{height:100%;margin:0;padding:0;}</style>
  <script>window._AMapSecurityConfig={securityJsCode:'${AMAP_JS_SECURITY}'};</script>
  <script src="https://webapi.amap.com/maps?v=2.0&key=${AMAP_JS_KEY}"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var points = ${pointsJson};
    var highlight = ${hi};
    var map = new AMap.Map('map', {
      resizeEnable: true,
      viewMode: '2D',
      mapStyle: 'amap://styles/fresh',
      features: ['bg', 'road', 'building', 'point']
    });
    var markers = points.map(function (p, i) {
      var isHi = p.index === highlight;
      var marker = new AMap.Marker({
        position: [p.lng, p.lat],
        title: p.name,
        label: {
          content: '<div style="background:' + (isHi ? '${mapPrimary}' : '${mapMuted}') + ';color:#fff;padding:2px 6px;border-radius:8px;font-size:11px;">' + (i+1) + '</div>',
          direction: 'top'
        },
        zIndex: isHi ? 200 : 100
      });
      var info = new AMap.InfoWindow({
        content: '<div style="padding:4px 8px;font-size:13px;">' + p.time + ' ' + p.name + '</div>',
        offset: new AMap.Pixel(0, -30)
      });
      marker.on('click', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', index: p.index }));
        }
        info.open(map, marker.getPosition());
      });
      return marker;
    });
    map.add(markers);
    if (points.length > 1) {
      var path = points.map(function(p){ return [p.lng, p.lat]; });
      var polyline = new AMap.Polyline({
        path: path,
        strokeColor: '${mapPrimary}',
        strokeOpacity: 0.6,
        strokeWeight: 3,
        strokeStyle: 'dashed'
      });
      map.add(polyline);
    }
    if (highlight >= 0) {
      var hp = points.find(function(p){ return p.index === highlight; });
      if (hp) map.setCenter([hp.lng, hp.lat]);
    }
    map.setFitView(markers, false, [60, 60, 60, 60]);
  </script>
</body>
</html>`;
  }, [points, selectedIndex]);

  if (!AMAP_JS_KEY) return null;
  if (points.length === 0) return null;

  if (offline) {
    return (
      <View style={[styles.wrap, styles.offline, { height: Math.min(height, 120) }]}>
        <Text style={styles.offlineText}>🗺️ 地图需联网查看</Text>
        <Text style={styles.offlineSub}>离线时仍可浏览下方行程安排</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://webapi.amap.com/' }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        scalesPageToFit
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data) as { type?: string; index?: number };
            if (data.type === 'marker' && typeof data.index === 'number') {
              onSelectIndex?.(data.index);
            }
          } catch {
            // ignore
          }
        }}
        onError={(ev) => console.warn('[TripMap] WebView 加载失败:', ev.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  web: { flex: 1 },
  offline: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.inputBg,
  },
  offlineText: {
    fontSize: font.body.size,
    color: colors.textMuted,
    fontWeight: '600',
  },
  offlineSub: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
});
