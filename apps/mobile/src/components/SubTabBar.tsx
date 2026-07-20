// 二级 Tab（分段切换控件）。用在「规划」Tab 顶部，切换「聊聊 / 规划行程」两个子页。
//
// 为什么不用第三方分段控件？就两个按钮 + 一条选中下划线，自己写十几行就够，
// 不值得引依赖。这是个「受控组件」：自己不存状态，当前选中哪个由父组件用 value 传进来，
// 点击时通过 onChange 通知父组件去改 —— 这样父组件才能根据选中项决定显示哪个子页。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, font } from '../theme';
import { MIN_TOUCH } from '../lib/a11y';

export interface SubTab {
  key: string;
  label: string;
}

interface Props {
  tabs: SubTab[];
  value: string; // 当前选中的 key
  onChange: (key: string) => void;
}

export function SubTabBar({ tabs, value, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.item}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
          >
            <Text style={[styles.label, active && styles.labelActive]} allowFontScaling>
              {t.label}
            </Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  label: {
    fontSize: font.body.size,
    fontWeight: '500',
    color: colors.textMuted,
    paddingBottom: spacing.sm,
  },
  labelActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  underline: {
    height: 3,
    width: '48%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: colors.primary,
  },
});
