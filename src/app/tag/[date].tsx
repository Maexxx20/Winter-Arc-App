import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PhotoStrip } from '@/components/photo-strip';
import { RuleRow } from '@/components/rule-row';
import { TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { T } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { t } from '@/i18n';
import { activeRules, computeStreak, ruleValue, weeklyCount } from '@/lib/arc';
import { diffDays, formatLong, isValidISO } from '@/lib/date';
import type { DayStatus } from '@/lib/types';
import { addPhoto, removePhoto, selectActiveArc, selectLog, setNote, setRuleValue, useAppState } from '@/store/store';

/** Nur der heutige Tag lässt sich bearbeiten – Verpasstes bleibt verpasst. */

/** Farbe des Status-Badges; der Text kommt aus history.status.* */
const STATUS_COLOR: Partial<Record<DayStatus, ThemeColor>> = {
  done: 'accent',
  partial: 'textSecondary',
  missed: 'textSecondary',
  shielded: 'shield',
  open: 'accent',
};

export default function DayScreen() {
  const theme = useTheme();
  const { date: raw, arc: arcParam } = useLocalSearchParams<{ date: string; arc?: string }>();
  const today = useToday();
  const state = useAppState();
  // Optional ein früherer Arc (z. B. aus Vorher/Nachher); dann nur ansehen
  const active = selectActiveArc(state);
  const arc = arcParam ? (state.arcs.find((a) => a.id === arcParam) ?? active) : active;
  const log = selectLog(state, arc?.id);
  const date = typeof raw === 'string' && isValidISO(raw) ? raw : today;

  const [note, setNoteText] = useState(log[date]?.note ?? '');
  useEffect(() => setNoteText(log[date]?.note ?? ''), [date]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notiz auch beim Zurückwischen speichern
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => () => pending.current?.(), []);

  const status = useMemo(() => (arc ? computeStreak(arc, log, today).statuses[date] : undefined), [arc, log, today, date]);
  if (!arc) return null;

  const inArc = date >= arc.startDate && date <= arc.endDate;
  const editable = arc.id === active?.id && inArc && date === today;
  const rules = activeRules(arc, date);
  const badgeColor = status ? STATUS_COLOR[status] : undefined;
  const badge = status && badgeColor ? { label: t(`history.status.${status}`), color: badgeColor } : undefined;
  const dayNumber = diffDays(arc.startDate, date) + 1;

  const saveNote = () => {
    if (editable && note !== (log[date]?.note ?? '')) setNote(arc.id, date, note);
  };
  pending.current = saveNote;

  return (
    <Screen>
      <ScreenHeader>
        <View style={styles.flex}>
          <T variant="label">{inArc ? t('history.day.number', { n: dayNumber }) : t('history.day.outside')}</T>
          <T variant="title">{date === today ? t('date.today') : formatLong(date)}</T>
        </View>
      </ScreenHeader>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.surfaceMuted }]}>
          <T variant="caption" color={badge.color} style={styles.badgeText}>
            {badge.label}
          </T>
        </View>
      ) : null}

      {!editable && inArc && date < today && (
        <T variant="caption" color="textSecondary">🔒 {t('history.day.editWindow')}</T>
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

      {editable ? (
        <TextField
          label={t('history.day.note')}
          value={note}
          onChangeText={setNoteText}
          onBlur={saveNote}
          multiline
          maxLength={1000}
          placeholder={t('history.day.notePlaceholder')}
        />
      ) : note.trim() ? (
        <View style={styles.photos}>
          <T variant="label">{t('history.day.note')}</T>
          <T color="textSecondary">{note.trim()}</T>
        </View>
      ) : null}

      {editable || log[date]?.photos?.length ? (
        <View style={styles.photos}>
          <T variant="label">{t('history.day.photos')}</T>
          <PhotoStrip
            photos={log[date]?.photos ?? []}
            readOnly={!editable}
            onAdd={(name) => addPhoto(arc.id, date, name)}
            onRemove={(name) => removePhoto(arc.id, date, name)}
          />
        </View>
      ) : null}
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
  photos: { gap: 6 },
});
