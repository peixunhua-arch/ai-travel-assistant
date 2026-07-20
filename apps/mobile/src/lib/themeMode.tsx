// §9.3 深色模式 + 主题切换
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { colors as lightColors, darkColors } from '../theme';

const KEY = 'themeMode'; // 'light' | 'dark' | 'system'

type Mode = 'light' | 'dark' | 'system';

type AppColors = typeof lightColors;

type ThemeContextValue = {
  mode: Mode;
  setMode: (m: Mode) => void;
  colors: AppColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  colors: lightColors,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = (isDark ? darkColors : lightColors) as AppColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
