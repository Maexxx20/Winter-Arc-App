import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { MyAvatar } from '@/components/avatar';
import { ConnectionsCard } from '@/components/connections-card';
import { exportData } from '@/services/export';
import { HealthLinkSheet } from '@/components/health-link-sheet';
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
import { LANG_NAMES, LANGS, t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { currentRules } from '@/lib/arc';
import { confirm } from '@/lib/confirm';
import { diffDays, formatNumeric, formatShort, toISO } from '@/lib/date';
import { describeHealthLink } from '@/lib/health';
import { formatTime } from '@/lib/reminders';
import { describeRule, HARD_MAX_RULES } from '@/lib/templates';
import type { Rule } from '@/lib/types';
import {
  abandonActiveArc,
  amendRules,
  resetAll,
  seedDemo,
  setRuleHealth,
  setRuleReminder,
  selectActiveArc,
  updateReminders,
  updateSettings,
  useAppState,
} from '@/store/store';
import { syncHealthNow } from '@/services/health-sync';
import { enableReminders } from '@/services/notifications';
import { pushProblemText, setCrewPush } from '@/services/push';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { deleteRemoteData, useSyncStatus } from '@/services/sync';

const ROLLOVER_OPTIONS = [0, 2, 3, 4];

export default function ContractScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const [editorOpen, setEditorOpen] = useState(false);
  const [linkRule, setLinkRule] = useState<Rule | null>(null);
  const session = useSession();
  const sync = useSyncStatus();
  if (!arc) return null;

  const beforeStart = today < arc.startDate;
  const reminders = state.settings.reminders;
  const rules = currentRules(arc);
  const canAmend = beforeStart || arc.amendmentsLeft > 0;
  const total = diffDays(arc.startDate, arc.endDate) + 1;

  const amendNotice = beforeStart
    ? t('contract.rules.noticeBefore')
    : arc.amendmentsLeft > 0
      ? t('contract.rules.noticeLeft', { count: arc.amendmentsLeft })
      : t('contract.rules.noticeNone');

  // «Ich, {name}, …»: Name fett, darum am Platzhalter aufteilen.
  const [pledgeBefore, pledgeAfter = ''] = t('contract.card.pledge', {
    start: formatShort(arc.startDate),
    end: formatShort(arc.endDate, true),
    days: t('common.days', { count: total }),
  }).split('{name}');

  const guardAmend = async (what: string) => {
    if (beforeStart) return true;
    return confirm(
      t('contract.rules.amendTitle'),
      t('contract.rules.amendCost', { what, count: arc.amendmentsLeft }),
      t('contract.rules.amendConfirm'),
    );
  };

  const removeRule = async (id: string, title: string) => {
    if (rules.length <= 1) return;
    if (!(await guardAmend(t('contract.rules.removeWhat', { title })))) return;
    amendRules(arc.id, { removeIds: [id] }, today);
  };

  return (
    <Screen tabs>
      <View style={styles.head}>
        <T variant="label">{arc.title}</T>
        <T variant="display">{t('contract.title')}</T>
      </View>

      <Card style={styles.contract}>
        <T variant="label" center>{t('contract.card.label')}</T>
        <T color="textSecondary">
          {pledgeBefore}
          <T variant="bodyStrong">{arc.signature?.name}</T>
          {pledgeAfter}
        </T>
        {arc.why ? <T color="textSecondary" style={styles.italic}>{t('contract.card.why', { why: arc.why })}</T> : null}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.sigRow}>
          <T style={[styles.signature, { color: theme.text }]}>{arc.signature?.name}</T>
          <T variant="caption" color="textTertiary">
            {t('contract.card.signedOn', { date: arc.signature ? formatNumeric(toISO(new Date(arc.signature.signedAt))) : '–' })}
          </T>
        </View>
      </Card>

      <SectionTitle
        action={
          !beforeStart ? (
            <T variant="caption" color={arc.amendmentsLeft > 0 ? 'textSecondary' : 'warning'}>
              {t('contract.rules.left', { count: arc.amendmentsLeft })}
            </T>
          ) : undefined
        }>
        {t('contract.rules.title')}
      </SectionTitle>
      {arc.crew ? (
        <T variant="caption" color="textSecondary">
          {t('crewx.arc.fromTemplate', { crew: arc.crew.crewName ?? '' })}
        </T>
      ) : null}
      <View style={styles.list}>
        {rules.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setLinkRule(r)}
            accessibilityHint={t('contract.rules.autoHint')}
            style={({ pressed }) => [styles.rule, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}>
            <T style={styles.emoji}>{r.icon}</T>
            <View style={styles.flex}>
              <T variant="bodyStrong">{r.title}</T>
              <T variant="caption">{describeRule(r)}</T>
              <T variant="caption" color={r.health ? 'accent' : 'textTertiary'}>
                {r.health ? describeHealthLink(r.health) : t('contract.rules.autoNone')}
              </T>
              {r.reminder !== undefined ? (
                <T variant="caption" color="textSecondary">
                  ⏰ {t('ruleReminder.inline', { time: formatTime(r.reminder) })}
                </T>
              ) : null}
            </View>
            {canAmend && rules.length > 1 && (
              <Pressable
                hitSlop={10}
                accessibilityLabel={t('contract.rules.removeA11y', { title: r.title })}
                onPress={() => removeRule(r.id, r.title)}
                style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
                <CloseIcon color={theme.textSecondary} size={14} />
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
      <HealthLinkSheet
        rule={linkRule}
        onClose={() => setLinkRule(null)}
        onSave={async (link, reminder) => {
          if (linkRule) {
            setRuleHealth(arc.id, linkRule.id, link);
            setRuleReminder(arc.id, linkRule.id, reminder);
          }
          setLinkRule(null);
          if (link) syncHealthNow(true);
          // Erinnerung gesetzt, aber Mitteilungen aus → einschalten
          if (reminder !== null && !state.settings.reminders.enabled) await enableReminders();
        }}
      />
      <T variant="caption" color="textTertiary">{amendNotice}</T>
      {canAmend && rules.length < HARD_MAX_RULES && (
        <Button
          title={t('contract.rules.add')}
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
          if (!(await guardAmend(t('contract.rules.addWhat', { title: rule.title })))) return;
          amendRules(arc.id, { add: [rule] }, today);
        }}
      />

      <SectionTitle>{t('contract.profileRow.title')}</SectionTitle>
      <Pressable
        onPress={() => router.push('/profil')}
        style={({ pressed }) => [styles.rule, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
        <MyAvatar size={36} />
        <View style={styles.flex}>
          <T variant="bodyStrong">{state.settings.name || t('contract.profileRow.fallbackName')}</T>
          <T variant="caption" numberOfLines={1}>
            {!supabaseConfigured
              ? t('contract.profileRow.offline')
              : session
                ? sync.state === 'error'
                  ? t('contract.profileRow.syncFailed')
                  : session.user.email
                : t('contract.profileRow.signedOut')}
          </T>
        </View>
        <ChevronIcon color={theme.textTertiary} size={16} />
      </Pressable>

      <SectionTitle>{t('contract.connections.title')}</SectionTitle>
      <ConnectionsCard />

      <SectionTitle>{t('contract.reminders.title')}</SectionTitle>
      <Card style={styles.settings}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <T variant="bodyStrong">{t('contract.reminders.title')}</T>
            <T variant="caption">{t('contract.reminders.hint')}</T>
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
          hint={t('contract.reminders.morningHint')}
          value={reminders.morning}
          fallback={7 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(morning) => updateReminders({ morning })}
        />
        <TimeRow
          label={t('contract.reminders.evening')}
          hint={t('contract.reminders.eveningHint')}
          value={reminders.evening}
          fallback={20 * 60 + 30}
          disabled={!reminders.enabled}
          onChange={(evening) => updateReminders({ evening })}
        />
        {supabaseConfigured && session ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <T variant="bodyStrong">{t('contract.reminders.crewPush')}</T>
              <T variant="caption">{t('contract.reminders.crewPushHint')}</T>
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
            <T variant="caption">{t('contract.reminders.weeklyHint')}</T>
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
          <T variant="caption" color="textTertiary">{t('language.hint')}</T>
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
          <T variant="caption" color="textTertiary">
            {t('contract.settings.rolloverHint')}
          </T>
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
        <T variant="caption" color="textSecondary">{t('extras.export.hint')}</T>
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
          <Button title={t('contract.danger.demo')} variant="ghost" small onPress={() => seedDemo(arc.id, today, 30)} />
        )}
      </Card>

      <T variant="caption" color="textTertiary" center>
        {session ? t('contract.footer.account') : t('contract.footer.local')}
      </T>
      <View style={styles.links}>
        <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
          <T variant="caption" color="accent">{t('contract.footer.privacy')}</T>
        </Pressable>
        <T variant="caption" color="textTertiary">·</T>
        <Pressable onPress={() => openLink(WEBSITE_URL)} hitSlop={8}>
          <T variant="caption" color="accent">{t('contract.footer.support')}</T>
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
