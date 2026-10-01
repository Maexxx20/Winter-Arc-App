import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

import { onLangChange, t } from '@/i18n';
import { todayISO } from '@/lib/date';
import { planReminders } from '@/lib/reminders';
import { getState, isHydrated, selectActiveArc, selectLog, subscribe, updateReminders } from '@/store/store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'reminders';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('system.reminders.channel'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function hasPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Fragt die Berechtigung an und schaltet die Erinnerungen entsprechend ein/aus. */
export async function enableReminders(): Promise<boolean> {
  await ensureChannel();
  let granted = await hasPermission();
  if (!granted) {
    const res = await Notifications.requestPermissionsAsync();
    granted = res.granted;
  }
  updateReminders({ enabled: granted });
  return granted;
}

let running = false;
let again = false;

/** Plant alle Erinnerungen neu (idempotent). */
export async function syncReminders(): Promise<void> {
  if (!isHydrated()) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const s = getState();
    const arc = selectActiveArc(s);
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!arc || !s.settings.reminders.enabled || !(await hasPermission())) return;
    await ensureChannel();
    const now = new Date();
    const plan = planReminders(arc, selectLog(s, arc.id), s.settings.reminders, now, todayISO(now, s.settings.rolloverHour));
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { url: r.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
      });
    }
  } catch (e) {
    console.warn('Erinnerungen konnten nicht geplant werden', e);
  } finally {
    running = false;
    if (again) {
      again = false;
      syncReminders();
    }
  }
}

/** Im Root-Layout: plant bei jeder Änderung und beim Öffnen der App neu. */
export function useReminderSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(syncReminders, 1500);
    };
    schedule();
    const unsub = subscribe(schedule);
    // Sprache gewechselt → Erinnerungen in der neuen Sprache neu planen
    const offLang = onLangChange(schedule);
    const appSub = RNAppState.addEventListener('change', (st) => st === 'active' && schedule());
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      offLang();
      appSub.remove();
    };
  }, []);
}

/** Im Tabs-Layout: öffnet den Link einer angetippten Benachrichtigung. */
export function useReminderLinks() {
  useEffect(() => {
    const open = (resp: Notifications.NotificationResponse | null) => {
      const url = resp?.notification.request.content.data?.url;
      if (typeof url === 'string' && url !== '/' && resp?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        router.push(url as never);
      }
    };
    Notifications.getLastNotificationResponseAsync().then((r) => {
      open(r);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    const tapSub = Notifications.addNotificationResponseReceivedListener(open);
    return () => tapSub.remove();
  }, []);
}
