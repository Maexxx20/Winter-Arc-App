/** Web-Vorschau: keine lokalen Benachrichtigungen. */
import { updateReminders } from '@/store/store';

export async function hasPermission(): Promise<boolean> {
  return false;
}

export async function enableReminders(): Promise<boolean> {
  updateReminders({ enabled: false });
  return false;
}

export async function syncReminders(): Promise<void> {}

export function useReminderSync() {}

export function useReminderLinks() {}
