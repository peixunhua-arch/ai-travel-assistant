// §16.3 长辈模式：更大字号、更大触控区、更少信息密度。
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font } from '../theme';

const ELDER_KEY = 'elderModeEnabled';
const FONT_SCALE = 1.28;
const TOUCH_MIN = 52;

/** 长辈模式下的更高对比配色 */
const ELDER_COLORS: Partial<Record<keyof typeof colors, string>> = {
  textStrong: '#0F0F0F', // 更深的墨黑
  textPrimary: '#1A1A1A',
  textMuted: '#5C4030', // 更深的茶褐
  bg: '#F5EFE5', // 更暖的宣纸
  border: '#B8A590', // 更深的青瓦灰
  borderLight: '#C8B8A5',
};

type ElderModeContextValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  scaleFont: (size: number) => number;
  scaleLineHeight: (lh: number) => number;
  touchMin: number;
  themeColors: typeof colors;
};

const ElderModeContext = createContext<ElderModeContextValue>({
  enabled: false,
  setEnabled: () => {},
  scaleFont: (s) => s,
  scaleLineHeight: (lh) => lh,
  touchMin: 44,
  themeColors: colors,
});

export function ElderModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ELDER_KEY).then((v) => {
      setEnabledState(v === '1');
      setReady(true);
    });
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    AsyncStorage.setItem(ELDER_KEY, v ? '1' : '0');
  }, []);

  const scaleFont = useCallback(
    (size: number) => (enabled ? Math.round(size * FONT_SCALE) : size),
    [enabled],
  );

  const scaleLineHeight = useCallback(
    (lh: number) => (enabled ? Math.round(lh * FONT_SCALE) : lh),
    [enabled],
  );

  const value: ElderModeContextValue = {
    enabled: ready ? enabled : false,
    setEnabled,
    scaleFont,
    scaleLineHeight,
    touchMin: (ready && enabled) ? TOUCH_MIN : 44,
    themeColors: (ready && enabled ? { ...colors, ...ELDER_COLORS } : colors) as typeof colors,
  };

  return (
    <ElderModeContext.Provider value={value}>
      {children}
    </ElderModeContext.Provider>
  );
}

export function useElderMode() {
  return useContext(ElderModeContext);
}

/** 长辈模式开启时返回更高对比 theme 色板 */
export function useThemeColors() {
  return useElderMode().themeColors;
}

/** 便捷：按长辈模式缩放 theme.font 档位 */
export function useScaledFont() {
  const { enabled, scaleFont, scaleLineHeight } = useElderMode();
  return {
    enabled,
    title: {
      size: scaleFont(font.title.size),
      lineHeight: scaleLineHeight(font.title.lineHeight),
      weight: font.title.weight,
    },
    body: {
      size: scaleFont(font.body.size),
      lineHeight: scaleLineHeight(font.body.lineHeight),
    },
    small: {
      size: scaleFont(font.small.size),
      lineHeight: scaleLineHeight(font.small.lineHeight),
    },
    tiny: {
      size: scaleFont(font.tiny.size),
      lineHeight: scaleLineHeight(font.tiny.lineHeight),
    },
  };
}
