// §5.5 点间通勤：优先高德距离 API，失败回退 Haversine。
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCommuteHint, haversineKm } from '../lib/geo';
import { fetchCommuteDistance } from '../api';
import { colors, spacing, font } from '../theme';

export function CommuteHint({
  fromLat,
  fromLng,
  toLat,
  toLng,
}: {
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (
      fromLat === undefined ||
      fromLng === undefined ||
      toLat === undefined ||
      toLng === undefined
    ) {
      setLabel(null);
      return;
    }
    const km = haversineKm(fromLat, fromLng, toLat, toLng);
    if (km < 0.05) {
      setLabel(null);
      return;
    }
    setLabel(formatCommuteHint(km));
    let cancelled = false;
    fetchCommuteDistance(fromLat, fromLng, toLat, toLng).then((r) => {
      if (!cancelled && r?.label) setLabel(r.label);
    });
    return () => {
      cancelled = true;
    };
  }, [fromLat, fromLng, toLat, toLng]);

  if (!label) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.arrow}>↓</Text>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: 2,
  },
  arrow: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
  },
  text: {
    fontSize: font.tiny.size,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
