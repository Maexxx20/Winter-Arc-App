import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { selectActiveArc, useAppState } from '@/store/store';

export default function TabsLayout() {
  const state = useAppState();
  if (!selectActiveArc(state)) return <Redirect href="/onboarding" />;
  return <AppTabs />;
}
