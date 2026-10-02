import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileButton } from '@/components/profile-button';
import { HealthLinkSheet } from '@/components/health-link-sheet';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { RuleEditor } from '@/components/rule-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { currentRules } from '@/lib/arc';
import { confirm } from '@/lib/confirm';
import { diffDays, formatNumeric, formatShort, toISO } from '@/lib/date';
import { describeHealthLink } from '@/lib/health';
import { formatTime } from '@/lib/reminders';
import { describeRule, HARD_MAX_RULES } from '@/lib/templates';
import type { Rule } from '@/lib/types';
import { amendRules, setRuleHealth, setRuleReminder, selectActiveArc, useAppState } from '@/store/store';
import { syncHealthNow } from '@/services/health-sync';
import { enableReminders } from '@/services/notifications';


export default function ContractScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const [editorOpen, setEditorOpen] = useState(false);
  const [linkRule, setLinkRule] = useState<Rule | null>(null);
  if (!arc) return null;

  const beforeStart = today < arc.startDate;
  const reminders = state.settings.reminders;
  const rules = currentRules(arc);
  const canAmend = beforeStart || arc.amendmentsLeft > 0;
  const total = diffDays(arc.startDate, arc.endDate) + 1;


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
      <View style={styles.headRow}>
        <View style={styles.head}>
          <T variant="label">{arc.title}</T>
          <T variant="display">{t('contract.title')}</T>
        </View>
        <ProfileButton />
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
              {r.health ? (
                <T variant="caption" color="accent">
                  {describeHealthLink(r.health)}
                </T>
              ) : null}
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

    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  head: { gap: 2, flex: 1 },
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
