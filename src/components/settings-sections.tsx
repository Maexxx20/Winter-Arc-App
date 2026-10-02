import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ConnectionsCard } from '@/components/connections-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, SectionTitle } from '@/components/ui/controls';
import { TimeRow } from '@/components/ui/time-row';
import { T } from '@/components/ui/text';
import { openLink, PRIVACY_URL, WEBSITE_URL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { LANG_NAMES, LANGS, t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { exportData } from '@/services/export';
import { enableReminders } from '@/services/notifications';
import { pushProblemText, setCrewPush } from '@/services/push';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { deleteRemoteData } from '@/services/sync';
import { abandonActiveArc, resetAll, seedDemo, selectActiveArc, updateReminders, updateSettings, useAppState } from '@/store/store';

const ROLLOVER_OPTIONS = [0, 2, 3, 4];

/** Alles, was nicht zum Vertrag gehört: Verbindungen, Erinnerungen, Einstellungen, Export, Gefahrenzone. Im Profil. */
export function SettingsSections() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const session = useSession();
  const arc = selectActiveArc(state);
  const reminders = state.settings.reminders;

  return (
    <>
      <SectionTitle>{t('contract.connections.title')}</SectionTitle>
      <ConnectionsCard />

      <SectionTitle>{t('contract.reminders.title')}</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <T variant="bodyStrong">{t('contract.reminders.title')}</T>
          </View>
          <Switch
            value={!!reminders.enabled}
            onValueChange={async (v) => {
              if (!v) return updateReminders({ enabled: false });
              const ok = await enableReminders();
              if (!ok) {
                await confirm(t('contract.reminders.blockedTitle'), t('contract.reminders.blockedBody'), t('common.ok'));
              }
            }}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
        <TimeRow
          label={t('contract.reminders.morning')}
          value={reminders.morning}
          fallback={7 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(morning) => updateReminders({ morning })}
        />
        <TimeRow
          label={t('contract.reminders.evening')}
          value={reminders.evening}
          fallback={20 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(evening) => updateReminders({ evening })}
        />
        {supabaseConfigured && session ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <T variant="bodyStrong">{t('contract.reminders.crewPush')}</T>
            </View>
            <Switch
              value={!!state.settings.crewPush}
              onValueChange={async (on) => {
                const problem = await setCrewPush(on);
                if (problem) await confirm(t('contract.reminders.crewPushOff'), pushProblemText(problem), t('common.ok'));
              }}
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        ) : null}
        <View style={[styles.switchRow, !reminders.enabled && styles.disabled]}>
          <View style={styles.flex}>
            <T variant="bodyStrong">{t('contract.reminders.weekly')}</T>
          </View>
          <Switch
            disabled={!reminders.enabled}
            value={reminders.weeklyReview}
            onValueChange={(weeklyReview) => updateReminders({ weeklyReview })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </Card>

      <SectionTitle>{t('contract.settings.title')}</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.setting}>
          <T variant="label">{t('language.title')}</T>
          <View style={styles.chips}>
            {(['system', ...LANGS] as const).map((l) => (
              <Chip
                key={l}
                label={l === 'system' ? t('language.system') : LANG_NAMES[l]}
                selected={(state.settings.language ?? 'system') === l}
                onPress={() => updateSettings({ language: l })}
              />
            ))}
          </View>
        </View>
        <View style={styles.setting}>
          <T variant="label">{t('contract.settings.rollover')}</T>
          <View style={styles.chips}>
            {ROLLOVER_OPTIONS.map((h) => (
              <Chip
                key={h}
                label={h === 0 ? t('contract.settings.midnight') : `${h}:00`}
                selected={state.settings.rolloverHour === h}
                onPress={() => updateSettings({ rolloverHour: h })}
              />
            ))}
          </View>
        </View>
        <View style={styles.switchRow}>
          <T variant="bodyStrong">{t('contract.settings.haptics')}</T>
          <Switch
            value={state.settings.haptics}
            onValueChange={(haptics) => updateSettings({ haptics })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </Card>

      <SectionTitle>{t('extras.export.title')}</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.chips}>
          {(['csv', 'json'] as const).map((f) => (
            <Button
              key={f}
              title={t(f === 'csv' ? 'extras.export.csv' : 'extras.export.json')}
              variant="secondary"
              small
              onPress={() =>
                exportData(f).catch((e) => confirm(t('common.error'), t('extras.export.failed', { error: e instanceof Error ? e.message : String(e) }), t('common.ok')))
              }
            />
          ))}
        </View>
      </Card>

      <SectionTitle>{t('contract.danger.title')}</SectionTitle>
      <Card style={styles.settings}>
        <Button
          title={t('contract.danger.abandon')}
          variant="secondary"
          onPress={async () => {
            if (await confirm(t('contract.danger.abandonTitle'), t('contract.danger.abandonBody'), t('contract.danger.abandonConfirm'), true)) {
              abandonActiveArc();
              router.replace('/onboarding');
            }
          }}
        />
        <Button
          title={t('contract.danger.deleteAll')}
          variant="danger"
          onPress={async () => {
            const msg = session ? t('contract.danger.deleteAllBodyAccount') : t('contract.danger.deleteAllBody');
            if (await confirm(t('contract.danger.deleteAllTitle'), msg, t('common.delete'), true)) {
              if (session) {
                try {
                  await deleteRemoteData();
                } catch (e) {
                  await confirm(t('contract.danger.deleteFailed'), e instanceof Error ? e.message : String(e), t('common.ok'));
                  return;
                }
              }
              await resetAll();
              router.replace('/onboarding');
            }
          }}
        />
        {__DEV__ && (
          <Button title={t('contract.danger.demo')} variant="ghost" small onPress={() => arc && seedDemo(arc.id, today, 30)} />
        )}
      </Card>
      <View style={styles.links}>
        <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
          <T variant="caption" color="accent">{t('contract.footer.privacy')}</T>
        </Pressable>
        <T variant="caption" color="textTertiary">·</T>
        <Pressable onPress={() => openLink(WEBSITE_URL)} hitSlop={8}>
          <T variant="caption" color="accent">{t('contract.footer.support')}</T>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  settings: { gap: Spacing.five },
  setting: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  flex: { flex: 1 },
  disabled: { opacity: 0.45 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
