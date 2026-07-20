// 设计 token —— 与「途灵」App 图标 / 启动页配色对齐。
// 主色：图标定位 Pin 与路线的青绿色；暖色：图标圆形背景的蜜桃橙；底色：奶油米白。

import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  // 朱砂红系（主色——按钮、链接、选中态、地图路线）
  primary: '#D23B3B',
  primaryDark: '#B8302F',
  primaryDisabled: '#E8A0A0',
  primaryBg: '#F9E8E8',

  // 鎏金系（强调色——用户气泡、提交按钮、分享卡片）
  accent: '#D4A03A',
  accentDark: '#B8882E',
  accentBg: '#FBF3E0',
  accentLight: '#F5E6C8',

  // 宣纸白系（底色）
  bg: '#F7F3ED',
  surface: '#FFFFFF',
  inputBg: '#F2EDE4',
  border: '#D9D0C4',
  borderLight: '#E8E0D5',

  // 墨色系（文字）
  textStrong: '#1C1C1C',
  textPrimary: '#2D2D2D',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#3D2B0F', // 深咖字在鎏金上，对比度 > 7
  textMuted: '#8B7355',
  textPlaceholder: '#B5A090',

  // 功能色
  danger: '#9B2D20', // 印章红——和主色朱砂区分（更深更暗）
  warningBg: '#FFF4E6',
  warningBorder: '#F5D4A8',
  warningText: '#A67C3D',

  success: '#2D8B5B', // 玉绿——好评（区分于主色红）
  successBg: '#E8F5EE',
  dangerBg: '#FDEEEE',

  accentFood: '#C8862E', // 琥珀金——餐饮
  accentHotel: '#4A5D8C', // 青黛蓝——住宿
} as const;

/** §9.3 深色模式配色 —— 墨韵东方·暗色 */
export const darkColors = {
  primary: '#E55050',
  primaryDark: '#D23B3B',
  primaryDisabled: '#5A3030',
  primaryBg: '#2E1A18',

  accent: '#E8B855',
  accentDark: '#D4A03A',
  accentBg: '#3D2E18',
  accentLight: '#4A3820',

  bg: '#1A1512', // 墨夜
  surface: '#2A221E', // 暖黑卡片
  inputBg: '#332A24',
  border: '#4A3D36',
  borderLight: '#3A302A',

  textStrong: '#F5EDE6',
  textPrimary: '#E8DDD4',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#3D2B0F',
  textMuted: '#A89588',
  textPlaceholder: '#7A6A5E',

  danger: '#F07070',
  warningBg: '#3D3020',
  warningBorder: '#6A5030',
  warningText: '#E8C080',

  success: '#5BAA8E',
  successBg: '#1A2E28',
  dangerBg: '#3D2020',

  accentFood: '#E8B855',
  accentHotel: '#6A7DAA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 18,
  pill: 24,
} as const;

export const font = {
  /** 顶栏品牌名 */
  display: { size: 22, lineHeight: 28, weight: '800' as const },
  title: { size: 17, lineHeight: 24, weight: '700' as const },
  body: { size: 15, lineHeight: 22, weight: '400' as const },
  small: { size: 13, lineHeight: 18, weight: '400' as const },
  tiny: { size: 12, lineHeight: 16, weight: '400' as const },
} as const;

/** 浅青灰 tint 的轻阴影，避免多层夸张 elevation */
function makeShadow(
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#3D2B1F',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
    default: {
      shadowColor: '#3D2B1F',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  })!;
}

export const shadow = {
  soft: makeShadow(0.08, 8, 2, 2),
  float: makeShadow(0.12, 12, -2, 4),
} as const;

/** 深色模式阴影（更低透明度） */
export const darkShadow = {
  soft: makeShadow(0.35, 8, 2, 3),
  float: makeShadow(0.45, 12, -2, 6),
} as const;
