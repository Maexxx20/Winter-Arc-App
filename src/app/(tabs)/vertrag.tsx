import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { MyAvatar } from '@/components/avatar';
import { ChevronIcon, CloseIcon, PlusIcon } from '@/components/icons';
import { RuleEditor } from '@/components/rule-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { TimeRow } from '@/components/ui/time-row';
import { T } from '@/components/ui/text';
import { openLink, PRIVACY_URL, WEBSITE_URL } from '@/constants/links';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { currentRules } from '@/lib/arc';
import { confirm } from '@/lib/confirm';
import { diffDays, formatNumeric, formatShort, toISO } from '@/lib/date';
import { describeRule, HARD_MAX_RULES } from '@/lib/templates';
import {
  abandonActiveArc,
  amendRules,
  resetAll,
  seedDemo,
  selectActiveArc,
  updateReminders,
  updateSettings,
  useAppState,
} from '@/store/store';
import { enableReminders } from '@/services/notifications';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { deleteRemoteData, useSyncStatus } from '@/services/sync';

const ROLLOVER_OPTIONS = [0, 2, 3, 4];

export default function ContractScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const [editorOpen, setEditorOpen] = useState(false);
  const session = useSession();
  const sync = useSyncStatus();
  if (!arc) return null;

  const beforeStart = today < arc.startDate;
  const reminders = state.settings.reminders;
  const rules = currentRules(arc);
  const canAmend = beforeStart || arc.amendmentsLeft > 0;
  const total = diffDays(arc.startDate, arc.endDate) + 1;

  const amendNotice = beforeStart
    ? 'Vor dem Start kannst du deine Regeln frei ändern.'
    : arc.amendmentsLeft > 0
      ? `Noch ${arc.amendmentsLeft} ${arc.amendmentsLeft === 1 ? 'Änderung' : 'Änderungen'} möglich. Änderungen gelten ab heute.`
      : 'Keine Änderungen mehr möglich. Du hast dein Wort gegeben.';

  const guardAmend = async (what: string) => {
    if (beforeStart) return true;
    return confirm(
      'Vertrag ändern?',
      `${what}\n\nDas kostet eine deiner ${arc.amendmentsLeft} verbleibenden Änderungen.`,
      'Ändern',
    );
  };

  const removeRule = async (id: string, title: string) => {
    if (rules.length <= 1) return;
    if (!(await guardAmend(`«${title}» wird ab heute aus deinem Vertrag entfernt.`))) return;
    amendRules(arc.id, { removeIds: [id] }, today);
  };

  return (
    <Screen tabs>
      <View style={styles.head}>
        <T variant="label">{arc.title}</T>
        <T variant="display">Vertrag</T>
      </View>

      <Card style={styles.contract}>
        <T variant="label" center>Vertrag mit mir selbst</T>
        <T color="textSecondary">
          Ich, <T variant="bodyStrong">{arc.signature?.name}</T>, halte mich vom {formatShort(arc.startDate)} bis{' '}
          {formatShort(arc.endDate, true)} ({total} Tage) an diese Regeln.
        </T>
        {arc.why ? <T color="textSecondary" style={styles.italic}>Weil: «{arc.why}»</T> : null}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.sigRow}>
          <T style={[styles.signature, { color: theme.text }]}>{arc.signature?.name}</T>
          <T variant="caption" color="textTertiary">
            unterschrieben am {arc.signature ? formatNumeric(toISO(new Date(arc.signature.signedAt))) : '–'}
          </T>
        </View>
      </Card>

      <SectionTitle
        action={
          !beforeStart ? (
            <T variant="caption" color={arc.amendmentsLeft > 0 ? 'textSecondary' : 'warning'}>
              {arc.amendmentsLeft} {arc.amendmentsLeft === 1 ? 'Änderung' : 'Änderungen'} übrig
            </T>
          ) : undefined
        }>
        Regeln
      </SectionTitle>
      <View style={styles.list}>
        {rules.map((r) => (
          <View key={r.id} style={[styles.rule, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <T style={styles.emoji}>{r.icon}</T>
            <View style={styles.flex}>
              <T variant="bodyStrong">{r.title}</T>
              <T variant="caption">{describeRule(r)}</T>
            </View>
            {canAmend && rules.length > 1 && (
              <Pressable
                hitSlop={10}
                accessibilityLabel={`${r.title} entfernen`}
                onPress={() => removeRule(r.id, r.title)}
                style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
                <CloseIcon color={theme.textSecondary} size={14} />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <T variant="caption" color="textTertiary">{amendNotice}</T>
      {canAmend && rules.length < HARD_MAX_RULES && (
        <Button
          title="Regel hinzufügen"
          variant="secondary"
          icon={<PlusIcon color={theme.text} size={16} />}
          onPress={() => setEditorOpen(true)}
        />
      )}

      <RuleEditor
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={async (rule) => {
          setEditorOpen(false);
          // Warten, bis das Sheet zu ist – sonst verschluckt iOS den Dialog.
          await new Promise((r) => setTimeout(r, 450));
          if (!(await guardAmend(`«${rule.title}» kommt ab heute in deinen Vertrag.`))) return;
          amendRules(arc.id, { add: [rule] }, today);
        }}
      />

      <SectionTitle>Profil & Konto</SectionTitle>
      <Pressable
        onPress={() => router.push('/profil')}
        style={({ pressed }) => [styles.rule, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
        <MyAvatar size={36} />
        <View style={styles.flex}>
          <T variant="bodyStrong">{state.settings.name || 'Dein Profil'}</T>
          <T variant="caption" numberOfLines={1}>
            {!supabaseConfigured
              ? 'Name, Bild und Statistik'
              : session
                ? sync.state === 'error'
                  ? 'Abgleich fehlgeschlagen – antippen'
                  : session.user.email
                : 'Nicht angemeldet · Konto & Sync'}
          </T>
        </View>
        <ChevronIcon color={theme.textTertiary} size={16} />
      </Pressable>

      <SectionTitle>Erinnerungen</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <T variant="bodyStrong">Erinnerungen</T>
            <T variant="caption">Abends nur, wenn noch etwas offen ist.</T>
          </View>
          <Switch
            value={!!reminders.enabled}
            onValueChange={async (v) => {
              if (!v) return updateReminders({ enabled: false });
              const ok = await enableReminders();
              if (!ok) {
                await confirm(
                  'Benachrichtigungen blockiert',
                  'Erlaube Benachrichtigungen für Nordwand in den Systemeinstellungen deines Handys.',
                  'OK',
                );
              }
            }}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
        <TimeRow
          label="Morgens"
          hint="Tag X von Y und ein kurzer Anstoss"
          value={reminders.morning}
          fallback={7 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(morning) => updateReminders({ morning })}
        />
        <TimeRow
          label="Abends"
          hint="Check-in, falls noch Regeln offen sind"
          value={reminders.evening}
          fallback={20 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(evening) => updateReminders({ evening })}
        />
        <View style={[styles.switchRow, !reminders.enabled && styles.disabled]}>
          <View style={styles.flex}>
            <T variant="bodyStrong">Wochenrückblick</T>
            <T variant="caption">Sonntagabend, zwei Minuten Reflexion</T>
          </View>
          <Switch
            disabled={!reminders.enabled}
            value={reminders.weeklyReview}
            onValueChange={(weeklyReview) => updateReminders({ weeklyReview })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </Card>

      <SectionTitle>Einstellungen</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.setting}>
          <T variant="label">Neuer Tag beginnt um</T>
          <View style={styles.chips}>
            {ROLLOVER_OPTIONS.map((h) => (
              <Chip
                key={h}
                label={h === 0 ? 'Mitternacht' : `${h}:00`}
                selected={state.settings.rolloverHour === h}
                onPress={() => updateSettings({ rolloverHour: h })}
              />
            ))}
          </View>
          <T variant="caption" color="textTertiary">
            Für Nachteulen: Was du um 1 Uhr abhakst, zählt dann noch zum Vortag.
          </T>
        </View>
        <View style={styles.switchRow}>
          <T variant="bodyStrong">Haptisches Feedback</T>
          <Switch
            value={state.settings.haptics}
            onValueChange={(haptics) => updateSettings({ haptics })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </Card>

      <SectionTitle>Gefahrenzone</SectionTitle>
      <Card style={styles.settings}>
        <Button
          title="Arc abbrechen"
          variant="secondary"
          onPress={async () => {
            if (await confirm('Arc abbrechen?', 'Dein Arc wird beendet. Du kannst danach einen neuen starten.', 'Arc beenden', true)) {
              abandonActiveArc();
              router.replace('/onboarding');
            }
          }}
        />
        <Button
          title="Alle Daten löschen"
          variant="danger"
          onPress={async () => {
            const msg = session
              ? 'Alle Arcs und Einträge werden auf diesem Gerät und in deinem Konto unwiderruflich gelöscht.'
              : 'Alle Arcs und Einträge werden unwiderruflich gelöscht.';
            if (await confirm('Alles löschen?', msg, 'Löschen', true)) {
              if (session) {
                try {
                  await deleteRemoteData();
                } catch (e) {
                  await confirm('Löschen fehlgeschlagen', String(e), 'OK');
                  return;
                }
              }
              await resetAll();
              router.replace('/onboarding');
            }
          }}
        />
        {__DEV__ && (
          <Button title="Beispieldaten (Dev)" variant="ghost" small onPress={() => seedDemo(arc.id, today, 30)} />
        )}
      </Card>

      <T variant="caption" color="textTertiary" center>
        {session ? 'Deine Daten sind in deinem Konto gesichert.' : 'Deine Daten liegen nur auf diesem Gerät.'}
      </T>
      <View style={styles.links}>
        <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
          <T variant="caption" color="accent">Datenschutz</T>
        </Pressable>
        <T variant="caption" color="textTertiary">·</T>
        <Pressable onPress={() => openLink(WEBSITE_URL)} hitSlop={8}>
          <T variant="caption" color="accent">Support</T>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  contract: { gap: Spacing.three, padding: Spacing.five },
  italic: { fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.two },
  sigRow: { gap: 2 },
  signature: { fontSize: 26, lineHeight: 34, fontStyle: 'italic', fontWeight: '300', letterSpacing: -0.5 },
  list: { gap: Spacing.two },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 20, lineHeight: 26 },
  flex: { flex: 1 },
  round: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  settings: { gap: Spacing.five },
  setting: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  disabled: { opacity: 0.45 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
