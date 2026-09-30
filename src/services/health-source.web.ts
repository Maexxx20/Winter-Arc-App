/** Web-Vorschau: keine Health-Daten. */
import type { ISODate } from '@/lib/date';
import type { HealthDay } from '@/lib/health';
import type { HealthMetric } from '@/lib/types';

export type HealthSupport = 'available' | 'expo-go' | 'unsupported' | 'needs-app';
export const healthProviderName = 'Apple Health';

export async function healthSupport(): Promise<HealthSupport> {
  return 'unsupported';
}
export async function requestHealthAccess(): Promise<boolean> {
  return false;
}
export async function readHealthDay(_date: ISODate, _metrics: Set<HealthMetric>): Promise<HealthDay> {
  return {};
}
