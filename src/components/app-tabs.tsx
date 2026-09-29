import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      tintColor={theme.accent}
      backgroundColor={theme.surface}
      iconColor={{ default: theme.textTertiary, selected: theme.accent }}
      labelStyle={{ default: { color: theme.textTertiary }, selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Heute</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="verlauf">
        <NativeTabs.Trigger.Label>Verlauf</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.3x3', selected: 'square.grid.3x3.fill' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vertrag">
        <NativeTabs.Trigger.Label>Vertrag</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="signature" md="draw" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
