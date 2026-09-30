import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { isRuleActiveOn, ruleValue } from '@/lib/arc';
import { addDays, type ISODate, todayISO } from '@/lib/date';
import { combineWorkoutMinutes, healthValueForRule, mergeHealthValue } from '@/lib/health';
import type { HealthMetric } from '@/lib/types';
import { getState, isHydrated, selectActiveArc, selectLog, setRuleValue } from '@/store/store';

import { healthSupport, readHealthDay } from './health-source';
import { stravaWorkoutMinutes } from './strava';
import { getSession } from './supabase';

let running: Promise<number> | null = null;
let lastRun = 0;

/**
 * Verknüpfte Regeln für heute und die zwei Tage davor aus Health/Strava abhaken.
 * Gibt zurück, wie viele Werte eingetragen wurden.
 */
export function syncHealthNow(force = false): Promise<number> {
  if (running) return running;
  if (!force && Date.now() - lastRun < 60_000) return Promise.resolve(0);
  running = doSync().finally(() => {
    running = null;
    lastRun = Date.now();
  });
  return running;
}

async function doSync(): Promise<number> {
  if (!isHydrated()) return 0;
  const s = getState();
  const arc = selectActiveArc(s);
  if (!arc) return 0;
  const linked = arc.rules.filter((r) => r.health);
  if (!linked.length) return 0;

  const useHealth = !!s.settings.healthEnabled && (await healthSupport()) === 'available';
  const useStrava = !!s.settings.stravaAthlete && !!getSession();
  if (!useHealth && !useStrava) return 0;

  const today = todayISO(new Date(), s.settings.rolloverHour);
  const dates = [0, 1, 2].map((n) => addDays(today, -n)).filter((d) => d >= arc.startDate && d <= arc.endDate);
  const strava =
    useStrava && linked.some((r) => r.health?.metric === 'workout') ? await stravaWorkoutMinutes(dates) : ({} as Record<ISODate, number>);

  let changed = 0;
  for (const date of dates) {
    const rules = linked.filter((r) => isRuleActiveOn(r, date));
    const metrics = new Set<HealthMetric>(rules.map((r) => r.health!.metric));
    const day = useHealth ? await readHealthDay(date, metrics) : {};
    if (metrics.has('workout')) day.workout = combineWorkoutMinutes(day.workout, strava[date]);

    const log = selectLog(getState(), arc.id);
    for (const rule of rules) {
      const next = mergeHealthValue(rule, ruleValue(log, date, rule.id), healthValueForRule(rule, rule.health!, day));
      if (next !== null) {
        setRuleValue(arc.id, date, rule.id, next);
        changed++;
      }
    }
  }
  return changed;
}

/** Im Root-Layout: beim Start, beim Öffnen der App und alle 15 Minuten im Vordergrund. */
export function useHealthSync() {
  useEffect(() => {
    const first = setTimeout(() => syncHealthNow(true).catch(() => undefined), 2000);
    const every = setInterval(() => {
      if (RNAppState.currentState === 'active') syncHealthNow().catch(() => undefined);
    }, 15 * 60_000);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') syncHealthNow().catch(() => undefined);
    });
    return () => {
      clearTimeout(first);
      clearInterval(every);
      sub.remove();
    };
  }, []);
}
