import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { RuleRow } from '@/components/rule-row';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { activeRules, computeStreak, ruleValue, weeklyCount } from '@/lib/arc';
import { diffDays, formatLong, isValidISO } from '@/lib/date';
import type { DayStatus } from '@/lib/types';
import { selectActiveArc, selectLog, setNote, setRuleValue, useAppState } from '@/store/store';

/** Wie viele Tage zurück darf nachgetragen werden? (heute + 2) */
export const EDIT_WINDOW_DAYS = 2;

const STATUS_LABEL: Partial<Record<DayStatus, { label: string; color: ThemeColor }>> = {
  done: { label: 'Gehalten', color: 'accent' },
  partial: { label: 'Teilweise', color: 'textSecondary' },
  missed: { label: 'Verpasst', color: 'textSecondary' },
  shielded: { label: 'Vom Schild gerettet', color: 'shield' },
  open: { label: 'Offen', color: 'accent' },
};

export default function DayScreen() {
  const theme = useTheme();
  const { date: raw } = useLocalSearchParams<{ date: string }>();
  const today = useToday();
  const state = useAppState();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const date = typeof raw === 'string' && isValidISO(raw) ? raw : today;

  const [note, setNoteText] = useState(log[date]?.note ?? '');
  useEffect(() => setNoteText(log[date]?.note ?? ''), [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = useMemo(() => (arc ? computeStreak(arc, log, today).statuses[date] : undefined), [arc, log, today, date]);
  if (!arc) return null;

  const inArc = date >= arc.startDate && date <= arc.endDate;
  const age = diffDays(date, today);
  const editable = inArc && age >= 0 && age <= EDIT_WINDOW_DAYS;
  const rules = activeRules(arc, date);
  const badge = status ? STATUS_LABEL[status] : undefined;
  const dayNumber = diffDays(arc.startDate, date) + 1;

  const saveNote = () => setNote(arc.id, date, note);

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">{inArc ? `Tag ${dayNumber}` : 'Ausserhalb des Arcs'}</T>
          <T variant="title">{date === today ? 'Heute' : formatLong(date)}</T>
        </View>
        <Pressable
          onPress={() => {
            saveNote();
            router.back();
          }}
          hitSlop={10}
          accessibilityLabel="Schliessen"
          style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.surfaceMuted }]}>
          <T variant="caption" color={badge.color} style={styles.badgeText}>
            {badge.label}
          </T>
        </View>
      ) : null}

      {!editable && inArc && age > 0 && (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">
            Nachtragen geht bis {EDIT_WINDOW_DAYS} Tage zurück. Ältere Tage bleiben, wie sie sind – das hält deinen Arc ehrlich.
          </T>
        </Card>
      )}

      {inArc && (
        <View style={styles.list}>
          {rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              value={ruleValue(log, date, r.id)}
              readOnly={!editable}
              weekCount={r.frequency.kind === 'weekly' ? weeklyCount(arc, log, r, date) : undefined}
              onChange={(v) => setRuleValue(arc.id, date, r.id, v)}
            />
          ))}
        </View>
      )}

      <TextField
        label="Notiz"
        value={note}
        onChangeText={setNoteText}
        onBlur={saveNote}
        multiline
        maxLength={1000}
        placeholder="Wie lief der Tag? Was hat geholfen, was nicht?"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1, gap: 2 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeText: { fontWeight: '600' },
  list: { gap: Spacing.two },
});
