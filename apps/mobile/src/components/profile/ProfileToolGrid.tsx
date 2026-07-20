// 出行工具宫格：圆底图标 + 短标签。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../../theme';
import { tapLight } from '../../haptics';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ProfileToolItem = {
  key: string;
  label: string;
  icon: IconName;
  tint: string;
  iconColor: string;
  onPress: () => void;
};

export function ProfileToolGrid({ items }: { items: ProfileToolItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.cell}
          onPress={() => {
            tapLight();
            item.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={[styles.iconCircle, { backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={22} color={item.iconColor} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,210,197,0.45)',
  },
  cell: {
    width: '33.33%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textStrong,
  },
});
