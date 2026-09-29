import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { T } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  small?: boolean;
};

export function Button({ title, variant = 'primary', icon, loading, small, disabled, onPress, style, ...rest }: Props) {
  const theme = useTheme();
  const bg =
    variant === 'primary' ? theme.accent : variant === 'secondary' ? theme.surfaceMuted : 'transparent';
  const fg =
    variant === 'primary' ? 'onAccent' : variant === 'danger' ? 'danger' : variant === 'ghost' ? 'accent' : 'text';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      style={(state) => [
        styles.base,
        small && styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.4 : state.pressed ? 0.8 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme[fg]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <T variant="bodyStrong" color={fg}>
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  small: { minHeight: 40, paddingHorizontal: Spacing.four, borderRadius: Radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
