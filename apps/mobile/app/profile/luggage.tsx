// 出行工具：行李清单模板（本机勾选）。
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../src/theme';
import { tapLight } from '../../src/haptics';

const KEY = 'luggageChecklist_v1';

const DEFAULT_ITEMS = [
  '身份证 / 护照',
  '充电宝与数据线',
  '换洗衣物',
  '洗漱用品',
  '常用药品',
  '雨具 / 遮阳伞',
  '拖鞋',
  '耳机',
  '现金与银行卡',
  '行程截图备份',
];

export default function LuggageScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEY).then((raw) => {
        if (!raw) return;
        try {
          setChecked(JSON.parse(raw) as Record<string, boolean>);
        } catch {
          // ignore
        }
      });
    }, []),
  );

  const toggle = async (item: string) => {
    tapLight();
    const next = { ...checked, [item]: !checked[item] };
    setChecked(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const done = DEFAULT_ITEMS.filter((i) => checked[i]).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.lead}>出发前勾一勾，漏带概率立刻下降</Text>
      <Text style={styles.progress}>
        已备好 {done}/{DEFAULT_ITEMS.length}
      </Text>
      <View style={styles.card}>
        {DEFAULT_ITEMS.map((item, idx) => {
          const on = !!checked[item];
          return (
            <TouchableOpacity
              key={item}
              style={[styles.row, idx < DEFAULT_ITEMS.length - 1 && styles.rowBorder]}
              onPress={() => toggle(item)}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? colors.primary : colors.textPlaceholder}
              />
              <Text style={[styles.label, on && styles.labelOn]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  lead: { fontSize: font.small.size, color: colors.textMuted, lineHeight: 20 },
  progress: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  label: { fontSize: font.body.size, color: colors.textStrong, fontWeight: '600' },
  labelOn: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
