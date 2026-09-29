/**
 * Design-Tokens. Hell, kühl, ruhig – "Frost" statt "Gamer-Dashboard".
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F3F5F8',
    surface: '#FFFFFF',
    surfaceMuted: '#EAEEF3',
    border: '#DDE3EA',
    text: '#0D1520',
    textSecondary: '#566372',
    textTertiary: '#8D99A7',
    accent: '#2657D9',
    accentSoft: '#E4EBFC',
    onAccent: '#FFFFFF',
    partial: '#9BB4EE',
    shield: '#E3A932',
    shieldSoft: '#FBF1DC',
    missed: '#D5DCE4',
    warning: '#B45309',
    warningSoft: '#FDF1E3',
    danger: '#C2362B',
  },
  dark: {
    background: '#0A0E13',
    surface: '#131920',
    surfaceMuted: '#1B232C',
    border: '#252E39',
    text: '#EEF2F6',
    textSecondary: '#9AA6B4',
    textTertiary: '#667280',
    accent: '#6D93F5',
    accentSoft: '#1A2640',
    onAccent: '#0A0E13',
    partial: '#34507F',
    shield: '#E6B24B',
    shieldSoft: '#2D2413',
    missed: '#27313C',
    warning: '#F0A04B',
    warningSoft: '#2C1F10',
    danger: '#EF6A5E',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof Palette;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
  ten: 40,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const MaxContentWidth = 560;
export const BottomTabInset = Platform.select({ ios: 60, android: 90, default: 90 }) ?? 0;
