import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = ViewProps & { tone?: ThemeColor; padded?: boolean; bordered?: boolean };

export function Card({ tone = 'surface', padded = true, bordered = true, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme[tone], borderColor: theme.border },
        bordered && styles.bordered,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  bordered: { borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: Spacing.four },
});
