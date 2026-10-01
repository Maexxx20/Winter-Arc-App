import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { supabaseConfigured } from '@/services/supabase';

export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      tintColor={theme.accent}
      backgroundColor={theme.surface}
      iconColor={{ default: theme.textTertiary, selected: theme.accent }}
      labelStyle={{ default: { color: theme.textTertiary }, selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('system.tabs.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="verlauf">
        <NativeTabs.Trigger.Label>{t('system.tabs.history')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.3x3', selected: 'square.grid.3x3.fill' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="crew" hidden={!supabaseConfigured}>
        <NativeTabs.Trigger.Label>{t('system.tabs.crew')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vertrag">
        <NativeTabs.Trigger.Label>{t('system.tabs.contract')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="signature" md="draw" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
