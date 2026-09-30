/**
 * Zugriff auf Apple Health (iOS) und Health Connect (Android).
 * Die nativen Module gibt es erst im Development-/Store-Build – in Expo Go meldet
 * `healthSupport()` einfach «nicht verfügbar», ohne abzustürzen.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { addDays, type ISODate, parseISO } from '@/lib/date';
import { type HealthDay, unionMinutes } from '@/lib/health';
import type { HealthMetric } from '@/lib/types';

export type HealthSupport = 'available' | 'expo-go' | 'unsupported' | 'needs-app';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');
type HealthConnect = typeof import('react-native-health-connect');

let hk: HealthKit | null | undefined;
let hc: HealthConnect | null | undefined;

const inExpoGo = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function healthKit(): HealthKit | null {
  if (hk !== undefined) return hk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hk = require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch {
    hk = null;
  }
  return hk;
}

function healthConnect(): HealthConnect | null {
  if (hc !== undefined) return hc;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hc = require('react-native-health-connect') as HealthConnect;
  } catch {
    hc = null;
  }
  return hc;
}

export const healthProviderName = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

export async function healthSupport(): Promise<HealthSupport> {
  if (Platform.OS === 'web') return 'unsupported';
  if (inExpoGo()) return 'expo-go';
  try {
    if (Platform.OS === 'ios') {
      const k = healthKit();
      return k && k.isHealthDataAvailable() ? 'available' : 'unsupported';
    }
    const c = healthConnect();
    if (!c) return 'unsupported';
    const status = await c.getSdkStatus();
    // 3 = SDK_AVAILABLE, 2 = SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    if (status === 3) return 'available';
    return status === 2 ? 'needs-app' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

const HK_READ = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDietaryWater',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKWorkoutTypeIdentifier',
] as const;

const HC_READ = ['Steps', 'ExerciseSession', 'SleepSession', 'Hydration', 'MindfulnessSession'] as const;

/** Leserechte anfragen. true, wenn der Dialog durchlief (iOS verrät nicht, was erlaubt wurde). */
export async function requestHealthAccess(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const k = healthKit();
      if (!k) return false;
      return await k.requestAuthorization({ toRead: HK_READ });
    }
    const c = healthConnect();
    if (!c) return false;
    await c.initialize();
    const granted = await c.requestPermission(HC_READ.map((recordType) => ({ accessType: 'read' as const, recordType })));
    return granted.length > 0;
  } catch (e) {
    console.warn('Health-Zugriff fehlgeschlagen', e);
    return false;
  }
}

// ---------- Hilfen ----------

/** Lokaler Tagesbeginn */
const dayStart = (date: ISODate) => parseISO(date);
const dayEnd = (date: ISODate) => parseISO(addDays(date, 1));

// Schlaf zählt für den Tag, an dem er endet (bis 18 Uhr – ein Mittagsschlaf gehört noch dazu).
const sleepWindow = (date: ISODate) => ({
  from: new Date(dayStart(date).getTime() - 12 * 3600_000),
  to: new Date(dayStart(date).getTime() + 18 * 3600_000),
  endFrom: dayStart(date),
});

// ---------- Lesen ----------

async function readIOS(date: ISODate, metrics: Set<HealthMetric>): Promise<HealthDay> {
  const k = healthKit();
  if (!k) return {};
  const range = { startDate: dayStart(date), endDate: dayEnd(date) };
  const out: HealthDay = {};

  if (metrics.has('steps')) {
    const r = await k.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
      filter: { date: range },
      unit: 'count',
    });
    out.steps = r.sumQuantity?.quantity ?? 0;
  }
  if (metrics.has('water')) {
    const r = await k.queryStatisticsForQuantity('HKQuantityTypeIdentifierDietaryWater', ['cumulativeSum'], {
      filter: { date: range },
      unit: 'mL',
    });
    out.water = (r.sumQuantity?.quantity ?? 0) / 1000;
  }
  if (metrics.has('workout')) {
    const workouts = await k.queryWorkoutSamples({ limit: 0, filter: { date: range } });
    out.workout = unionMinutes(workouts.map((w) => ({ start: w.startDate.getTime(), end: w.endDate.getTime() })));
  }
  if (metrics.has('mindful')) {
    const s = await k.queryCategorySamples('HKCategoryTypeIdentifierMindfulSession', { limit: 0, filter: { date: range } });
    out.mindful = unionMinutes(s.map((x) => ({ start: x.startDate.getTime(), end: x.endDate.getTime() })));
  }
  if (metrics.has('sleep')) {
    const w = sleepWindow(date);
    const s = await k.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter: { date: { startDate: w.from, endDate: w.to } },
    });
    // 1 = geschlafen (ohne Phase), 3 = Kern, 4 = Tief, 5 = REM; 0 = im Bett, 2 = wach zählen nicht
    const asleep = s.filter((x) => [1, 3, 4, 5].includes(Number(x.value)) && x.endDate >= w.endFrom);
    out.sleep = unionMinutes(asleep.map((x) => ({ start: x.startDate.getTime(), end: x.endDate.getTime() }))) / 60;
  }
  return out;
}

async function readAndroid(date: ISODate, metrics: Set<HealthMetric>): Promise<HealthDay> {
  const c = healthConnect();
  if (!c) return {};
  await c.initialize();
  const timeRangeFilter = { operator: 'between' as const, startTime: dayStart(date).toISOString(), endTime: dayEnd(date).toISOString() };
  const out: HealthDay = {};
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      return undefined; // keine Berechtigung für diese Messung
    }
  };

  if (metrics.has('steps')) {
    const r = await safe(() => c.aggregateRecord({ recordType: 'Steps', timeRangeFilter }));
    if (r) out.steps = r.COUNT_TOTAL;
  }
  if (metrics.has('water')) {
    const r = await safe(() => c.aggregateRecord({ recordType: 'Hydration', timeRangeFilter }));
    if (r) out.water = r.VOLUME_TOTAL.inLiters;
  }
  if (metrics.has('workout')) {
    const r = await safe(() => c.readRecords('ExerciseSession', { timeRangeFilter }));
    if (r) out.workout = unionMinutes(r.records.map((x) => ({ start: Date.parse(x.startTime), end: Date.parse(x.endTime) })));
  }
  if (metrics.has('mindful')) {
    const r = await safe(() => c.readRecords('MindfulnessSession', { timeRangeFilter }));
    if (r) out.mindful = unionMinutes(r.records.map((x) => ({ start: Date.parse(x.startTime), end: Date.parse(x.endTime) })));
  }
  if (metrics.has('sleep')) {
    const w = sleepWindow(date);
    const r = await safe(() =>
      c.readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: w.from.toISOString(), endTime: w.to.toISOString() } }),
    );
    if (r) {
      const sessions = r.records.filter((x) => Date.parse(x.endTime) >= w.endFrom.getTime());
      const total = unionMinutes(sessions.map((x) => ({ start: Date.parse(x.startTime), end: Date.parse(x.endTime) })));
      // Wachphasen abziehen (1 = wach, 3 = aufgestanden, 7 = wach im Bett), falls vorhanden
      const awake = unionMinutes(
        sessions.flatMap((x) =>
          (x.stages ?? []).filter((st) => st.stage === 1 || st.stage === 3 || st.stage === 7).map((st) => ({ start: Date.parse(st.startTime), end: Date.parse(st.endTime) })),
        ),
      );
      out.sleep = Math.max(0, total - awake) / 60;
    }
  }
  return out;
}

/** Tageswerte für die gewünschten Messungen. */
export async function readHealthDay(date: ISODate, metrics: Set<HealthMetric>): Promise<HealthDay> {
  if (!metrics.size || (await healthSupport()) !== 'available') return {};
  try {
    return Platform.OS === 'ios' ? await readIOS(date, metrics) : await readAndroid(date, metrics);
  } catch (e) {
    console.warn('Health lesen fehlgeschlagen', e);
    return {};
  }
}
