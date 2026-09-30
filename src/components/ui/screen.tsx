import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  /** Platz für die Tab-Leiste unten lassen. */
  tabs?: boolean;
  /** Fixer Bereich unten (z. B. Haupt-Button). */
  footer?: ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  /** Nach unten ziehen zum Aktualisieren. */
  refreshing?: boolean;
  onRefresh?: () => void;
} & Pick<ScrollViewProps, 'keyboardShouldPersistTaps'>;

export function Screen({ children, tabs, footer, scroll = true, topInset = true, refreshing, onRefresh, ...rest }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = (tabs ? BottomTabInset : 0) + (footer ? 0 : insets.bottom) + Spacing.six;

  const content = <View style={styles.inner}>{children}</View>;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: (topInset ? insets.top : 0) + Spacing.four, paddingBottom: bottom },
          ]}
          keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? 'handled'}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.textTertiary} /> : undefined
          }
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, styles.fill, { paddingTop: (topInset ? insets.top : 0) + Spacing.four, paddingBottom: bottom }]}>
          {content}
        </View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + Spacing.four, backgroundColor: theme.background, borderTopColor: theme.border },
          ]}>
          <View style={styles.inner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.five, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  footer: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
