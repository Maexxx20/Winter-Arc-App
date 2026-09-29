import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { defaultReviewWeek, weekSummary } from '@/lib/arc';
import { addDays, formatShort, isValidISO, weekdayShortNames, weekStart } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import type { DayStatus } from '@/lib/types';
import { saveReview, selectActiveArc, selectLog, selectReviews, useAppState } from '@/store/store';

const RATINGS = ['😣', '😕', '😐', '🙂', '🔥'];

export default function ReviewScreen() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const reviews = selectReviews(state, arc?.id);
  const { week: raw } = useLocalSearchParams<{ week?: string }>();

  let week = typeof raw === 'string' && isValidISO(raw) ? weekStart(raw) : defaultReviewWeek(today);
  if (arc && addDays(week, 6) < arc.startDate) week = weekStart(arc.startDate);

  const existing = reviews[week];
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [wins, setWins] = useState(existing?.wins ?? '');
  const [obstacles, setObstacles] = useState(existing?.obstacles ?? '');
  const [nextWeek, setNextWeek] = useState(existing?.nextWeek ?? '');

  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setWins(existing?.wins ?? '');
    setObstacles(existing?.obstacles ?? '');
    setNextWeek(existing?.nextWeek ?? '');
  }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => (arc ? weekSummary(arc, log, week, today) : null), [arc, log, week, today]);
  if (!arc || !summary) return null;

  const colorOf = (s: DayStatus) =>
    s === 'done' ? theme.accent : s === 'partial' ? theme.partial : s === 'shielded' ? theme.shield : s === 'missed' ? theme.missed : theme.surfaceMuted;

  const save = () => {
    saveReview(arc.id, week, { rating, wins: wins.trim(), obstacles: obstacles.trim(), nextWeek: nextWeek.trim() });
    haptic.success();
    router.back();
  };

  return (
    <Screen topInset={Platform.OS !== 'ios'} footer={<Button title={existing ? 'Aktualisieren' : 'Rückblick speichern'} onPress={save} disabled={!rating} />}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">
            {formatShort(addDays(week, 0))} – {formatShort(addDays(week, 6))}
          </T>
          <T variant="title">Woche {summary.index}</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      <Card style={styles.summary}>
        <View style={styles.weekRow}>
          {weekdayShortNames.map((wd, i) => {
            const d = summary.days.find((x) => x.date === addDays(week, i));
            return (
              <View key={wd} style={styles.dayCol}>
                <View style={[styles.dayDot, { backgroundColor: d ? colorOf(d.status) : 'transparent', borderColor: d?.status === 'open' ? theme.accent : 'transparent' }]} />
                <T variant="caption" color="textTertiary" style={styles.wd}>
                  {wd}
                </T>
              </View>
            );
          })}
        </View>
        <T variant="number">
          {summary.held} von {summary.days.length} Tagen gehalten
        </T>
        <View style={styles.rules}>
          {summary.rules.map(({ rule, hits, expected }) => (
            <View key={rule.id} style={styles.ruleRow}>
              <T style={styles.emoji}>{rule.icon}</T>
              <T variant="caption" style={styles.flex} numberOfLines={1}>
                {rule.title}
              </T>
              <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
                <View style={[styles.barFill, { backgroundColor: theme.accent, width: `${expected ? (hits / expected) * 100 : 0}%` }]} />
              </View>
              <T variant="caption" style={styles.count}>
                {hits}/{expected}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>Wie war deine Woche?</SectionTitle>
      <View style={styles.ratings}>
        {RATINGS.map((e, i) => {
          const active = rating === i + 1;
          return (
            <Pressable
              key={e}
              onPress={() => {
                haptic.tap();
                setRating(i + 1);
              }}
              accessibilityLabel={`Bewertung ${i + 1} von 5`}
              style={[styles.rating, { backgroundColor: active ? theme.accentSoft : theme.surface, borderColor: active ? theme.accent : theme.border }]}>
              <T style={styles.ratingEmoji}>{e}</T>
            </Pressable>
          );
        })}
      </View>

      <TextField label="Was lief gut?" value={wins} onChangeText={setWins} multiline maxLength={500} placeholder="Worauf bist du stolz?" />
      <TextField label="Was hat dich gebremst?" value={obstacles} onChangeText={setObstacles} multiline maxLength={500} placeholder="Wann und warum hast du verpasst?" />
      <TextField
        label="Fokus für nächste Woche"
        value={nextWeek}
        onChangeText={setNextWeek}
        multiline
        maxLength={500}
        placeholder="Eine konkrete Sache, z. B. «Sporttasche am Vorabend packen»"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: Spacing.four },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  dayDot: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5 },
  wd: { fontSize: 11 },
  rules: { gap: Spacing.two },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emoji: { fontSize: 16, lineHeight: 22, width: 22 },
  bar: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  count: { width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  ratings: { flexDirection: 'row', gap: Spacing.two },
  rating: { flex: 1, aspectRatio: 1, maxHeight: 64, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ratingEmoji: { fontSize: 26, lineHeight: 32 },
});
