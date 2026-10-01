import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { BadgeCelebration } from '@/components/badge-celebration';
import { useReminderLinks } from '@/services/notifications';
import { useQuickActions } from '@/services/quick-actions';
import { selectActiveArc, useAppState } from '@/store/store';

export default function TabsLayout() {
  const state = useAppState();
  useReminderLinks();
  useQuickActions();
  if (!selectActiveArc(state)) return <Redirect href="/onboarding" />;
  return (
    <>
      <AppTabs />
      <BadgeCelebration />
    </>
  );
}
