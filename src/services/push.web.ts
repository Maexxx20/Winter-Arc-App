/** Web-Vorschau: kein Push. */
import { t } from '@/i18n';

export type PushProblem = 'no-project' | 'simulator' | 'web' | 'denied' | 'signed-out' | 'failed';

export function pushProblemText(_p: PushProblem): string {
  return t('system.push.web');
}

export async function registerPush(): Promise<PushProblem | null> {
  return 'web';
}

export async function unregisterPush(): Promise<void> {}

export async function setCrewPush(_on: boolean): Promise<PushProblem | null> {
  return 'web';
}

export function usePushRegistration() {}
