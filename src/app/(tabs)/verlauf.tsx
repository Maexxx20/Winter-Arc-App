import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Heatmap, HeatmapLegend } from '@/components/heatmap';
import { StatTile } from '@/components/stat-tile';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { computeStats } from '@/lib/arc';
import { formatShort } from '@/lib/date';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, useAppState } from '@/store/store';

export default function HistoryScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const stats = useMemo(() => (arc ? computeStats(arc, log, today) : null), [arc, log, today]);
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

      <SectionTitle>Regeln</SectionTitle>
      <Card style={styles.rules}>
        {stats.ruleStats.map(({ rule, consistency, hits, expected }) => (
          <View key={rule.id} style={styles.rule}>
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
            </View>
            <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.barFill, { width: `${consistency * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <T variant="caption" color="textTertiary">
              {hits} von {expected} {rule.frequency.kind === 'weekly' ? 'Einheiten' : 'Tagen'}
            </T>
          </View>
        ))}
      </Card>

      <T variant="caption" color="textTertiary" center>
        Tippe auf einen Tag, um Details zu sehen oder ihn nachzutragen.
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
  barFill: { height: 6, borderRadius: 3 },
});
