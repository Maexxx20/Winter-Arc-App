import { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import { type ISODate, todayISO } from '@/lib/date';
import { useAppState } from '@/store/store';

/** Aktueller Kalendertag – aktualisiert sich bei Mitternacht und beim Zurückkehren in die App. */
export function useToday(): ISODate {
  const { settings } = useAppState();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  return todayISO(now, settings.rolloverHour);
}
