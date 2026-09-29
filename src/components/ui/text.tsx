import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextVariant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'number';

export type TProps = TextProps & {
  variant?: TextVariant;
  color?: ThemeColor;
  center?: boolean;
};

export function T({ variant = 'body', color, center, style, ...rest }: TProps) {
  const theme = useTheme();
  const defaultColor: ThemeColor =
    variant === 'caption' || variant === 'label' ? 'textSecondary' : 'text';
  return (
    <Text
      style={[
        styles.base,
        styles[variant],
        { color: theme[color ?? defaultColor] },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts?.sans },
  center: { textAlign: 'center' },
  hero: { fontSize: 64, lineHeight: 68, fontWeight: '700', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { fontSize: 22, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
});
