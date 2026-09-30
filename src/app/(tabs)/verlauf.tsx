import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Heatmap, HeatmapLegend } from '@/components/heatmap';
import { ChevronIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/stat-tile';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { arcWeeks, computeStats, weekSummary } from '@/lib/arc';
import { addDays, formatShort } from '@/lib/date';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, selectReviews, useAppState } from '@/store/store';

const RATING_EMOJI = ['', '😣', '😕', '😐', '🙂', '🔥'];

export default function HistoryScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const reviews = selectReviews(state, arc?.id);
  const stats = useMemo(() => (arc ? computeStats(arc, log, today) : null), [arc, log, today]);
  const weeks = useMemo(
    () => (arc ? arcWeeks(arc).filter((w) => w <= today).map((w) => weekSummary(arc, log, w, today)).reverse() : []),
    [arc, log, today],
  );
  if (!arc || !stats) return null;

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <Screen tabs>
      <View style={styles.head}>
        <T variant="label">
          {formatShort(arc.startDate)} – {formatShort(arc.endDate, true)}
        </T>
        <T variant="display">Verlauf</T>
      </View>

      <View style={styles.tiles}>
        <StatTile label="Gehalten" value={`${stats.doneDays}`} sub={`von ${stats.evaluatedDays} Tagen`} />
        <StatTile label="Quote" value={stats.evaluatedDays ? pct(stats.completionRate) : '–'} sub="aller Tage" />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Bester Streak" value={`${stats.streak.best}`} sub={`aktuell ${stats.streak.current}`} />
        <StatTile label="Schilde" value={`${stats.shieldedDays}`} sub="Tage gerettet" />
      </View>

      <Card style={styles.heat}>
        <Heatmap
          startDate={arc.startDate}
          endDate={arc.endDate}
          today={today}
          statuses={stats.streak.statuses}
          onPressDay={(date) => router.push({ pathname: '/tag/[date]', params: { date } })}
        />
        <HeatmapLegend />
      </Card>

      {stats.started && (
        <Button title="Fortschritt teilen" variant="secondary" onPress={() => router.push('/teilen')} />
      )}

      {weeks.length > 0 && stats.started && (
        <>
          <SectionTitle>Wochen</SectionTitle>
          <View style={styles.weeks}>
            {weeks.map((w) => {
              const r = reviews[w.week];
              return (
                <Pressable
                  key={w.week}
                  onPress={() => router.push({ pathname: '/rueckblick', params: { week: w.week } })}
                  style={({ pressed }) => [styles.weekRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">Woche {w.index}</T>
                    <T variant="caption">
                      {formatShort(w.week)} – {formatShort(addDays(w.week, 6))} · {w.held}/{w.days.length} gehalten
                    </T>
                  </View>
                  {r ? (
                    <T style={styles.emoji}>{RATING_EMOJI[r.rating]}</T>
                  ) : (
                    <T variant="caption" color="accent">
                      {w.complete ? 'Rückblick' : 'läuft'}
                    </T>
                  )}
                  <ChevronIcon color={theme.textTertiary} size={16} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <SectionTitle>Regeln</SectionTitle>
      <Card style={styles.rules}>
        {stats.ruleStats.map(({ rule, consistency, hits, expected }) => (
          <Pressable
            key={rule.id}
            onPress={() => router.push({ pathname: '/regel/[id]', params: { id: rule.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Statistik für ${rule.title}`}
            style={({ pressed }) => [styles.rule, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={styles.ruleHead}>
              <T style={styles.emoji}>{rule.icon}</T>
              <View style={styles.flex}>
                <T variant="bodyStrong" numberOfLines={1}>
                  {rule.title}
                  {rule.removedOn ? <T variant="caption" color="textTertiary">  · entfernt</T> : null}
                </T>
                <T variant="caption">{describeRule(rule)}</T>
              </View>
              <T variant="bodyStrong">{expected ? pct(consistency) : '–'}</T>
              <ChevronIcon color={theme.textTertiary} size={14} />
            </View>
            <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.barFill, { width: `${consistency * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <T variant="caption" color="textTertiary">
              {hits} von {expected} {rule.frequency.kind === 'weekly' ? 'Einheiten' : 'Tagen'}
            </T>
          </Pressable>
        ))}
      </Card>

      <T variant="caption" color="textTertiary" center>
        Tippe auf einen Tag, um ihn nachzutragen, oder auf eine Regel für ihre Statistik.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  heat: { gap: Spacing.four },
  rules: { gap: Spacing.five },
  rule: { gap: 6 },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emoji: { fontSize: 20, lineHeight: 26 },
  flex: { flex: 1 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  weeks: { gap: Spacing.two },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barFill: { height: 6, borderRadius: 3 },
});
