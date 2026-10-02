import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Zurück – auch wenn die Seite direkt geöffnet wurde (Link, Mitteilung) und es kein «davor» gibt. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Kopf jeder Unterseite: Zurück-Pfeil immer oben links, daneben Titel. */
export function ScreenHeader({ children, onBack, right }: { children?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? goBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        style={({ pressed }) => [styles.back, { backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
        <ChevronIcon dir="left" color={theme.text} size={18} />
      </Pressable>
      {children}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.one },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
