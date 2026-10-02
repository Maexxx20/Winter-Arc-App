import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useLang } from '@/i18n';
import { applyLanguage, useLanguageSync } from '@/services/language';
import { useReminderSync } from '@/services/notifications';
import { useHealthSync } from '@/services/health-sync';
import { usePushRegistration } from '@/services/push';
import { useSyncLoop } from '@/services/sync';
import { useWidgetSync } from '@/services/widget';
import { hydrate, useHydrated } from '@/store/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const hydrated = useHydrated();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const lang = useLang();
  useLanguageSync();
  useReminderSync();
  useSyncLoop();
  usePushRegistration();
  useHealthSync();
  useWidgetSync();

  useEffect(() => {
    hydrate(applyLanguage).finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, []);

  if (!hydrated) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: palette.background, card: palette.background, primary: palette.accent, text: palette.text, border: palette.border },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {/* Bei einem Sprachwechsel alles neu aufbauen, damit überall die neuen Texte stehen. */}
        <Stack key={lang} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="tag/[date]" />
          <Stack.Screen name="rueckblick" />
          <Stack.Screen name="teilen" />
          <Stack.Screen name="konto" />
          <Stack.Screen name="profil" />
          <Stack.Screen name="crew/mitglied" />
          <Stack.Screen name="crew/challenge" />
          <Stack.Screen name="crew/arc" />
          <Stack.Screen name="fortschritt/index" />
          <Stack.Screen name="arc-rueckblick" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="regel/[id]" />
          <Stack.Screen name="arcs" />
          <Stack.Screen name="arc/[id]" />
          <Stack.Screen name="crew/[id]" />
          <Stack.Screen name="crew/beitreten" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
