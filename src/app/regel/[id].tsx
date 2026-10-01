import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CloseIcon } from '@/components/icons';
import { StatTile } from '@/components/stat-tile';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { formatShort, weekdayShortNames } from '@/lib/date';
import { ruleDetail } from '@/lib/rule-stats';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, useAppState } from '@/store/store';

const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1)).replace('.', ',');

/** Statistik einer Regel. Parameter: id der Regel, optional arc (sonst aktiver Arc). */
export default function RuleScreen() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const { id, arc: arcId } = useLocalSearchParams<{ id: string; arc?: string }>();
  const arc = arcId ? state.arcs.find((a) => a.id === arcId) : selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const rule = arc?.rules.find((r) => r.id === id);
  const d = useMemo(() => (arc && rule ? ruleDetail(arc, log, rule, today) : null), [arc, log, rule, today]);

  if (!arc || !rule || !d) return null;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const started = d.expected > 0 || d.weeks.length > 0;

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <T style={styles.icon}>{rule.icon}</T>
        <View style={styles.flex}>
          <T variant="title" numberOfLines={2}>{rule.title}</T>
          <T variant="caption">
            {describeRule(rule)}
            {rule.removedOn ? ` · entfernt am ${formatShort(rule.removedOn)}` : ''}
          </T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {!started ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">Noch keine Daten. Die Statistik füllt sich ab dem ersten Tag.</T>
        </Card>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              label="Quote"
              value={d.expected ? pct(d.rate) : '–'}
              sub={`${d.hits} von ${d.expected} ${d.runUnit === 'Tage' ? 'Tagen' : 'Einheiten'}`}
            />
            <StatTile label="Serie" value={`${d.currentRun}`} sub={`${d.runUnit} · Rekord ${d.bestRun}`} />
          </View>

          {d.recent.length ? (
            <Card style={styles.card}>
              <T variant="label">Letzte {d.recent.length} Tage</T>
              <View style={styles.strip}>
                {d.recent.map((r) => (
                  <View
                    key={r.date}
                    accessibilityLabel={`${formatShort(r.date)}: ${r.hit ? 'erfüllt' : 'nicht erfüllt'}`}
                    style={[styles.cell, { backgroundColor: r.hit ? theme.accent : theme.surfaceMuted }]}
                  />
                ))}
              </View>
              <View style={styles.row}>
                <T variant="caption" color="textTertiary">{formatShort(d.recent[0].date)}</T>
                <T variant="caption" color="textTertiary">{formatShort(d.recent[d.recent.length - 1].date)}</T>
              </View>
            </Card>
          ) : null}

          <SectionTitle>Pro Woche</SectionTitle>
          <Card style={styles.card}>
            <BarChart
              bars={d.weeks.map((w, i) => ({
                label: `${i + 1}`,
                ratio: w.target ? Math.min(1, w.hits / w.target) : 0,
                value: `${w.hits}/${w.target}`,
                pending: w.running,
              }))}
              highlight={d.weeks.length - 1}
            />
            <T variant="caption" color="textTertiary">
              {rule.frequency.kind === 'daily' ? 'Erfüllte Tage pro Arc-Woche.' : 'Einheiten pro Arc-Woche im Verhältnis zum Ziel.'} Antippen zeigt die Zahl.
            </T>
          </Card>

          {rule.frequency.kind === 'daily' ? (
            <>
              <SectionTitle>Wochentage</SectionTitle>
              <Card style={styles.card}>
                <BarChart
                  bars={d.weekdays.map((w) => ({
                    label: weekdayShortNames()[w.weekday],
                    ratio: w.rate,
                    value: w.days ? pct(w.rate) : '–',
                  }))}
                  highlight={d.weakestWeekday}
                />
                <T variant="caption" color={d.weakestWeekday !== null ? 'text' : 'textTertiary'}>
                  {d.weakestWeekday !== null
                    ? `Am schwierigsten ist der ${WEEKDAY_NAMES[d.weakestWeekday]} (${pct(d.weekdays[d.weakestWeekday].rate)}). Plan dort bewusst Zeit ein.`
                    : 'Ab zwei Wochen zeigt sich, welcher Wochentag dir am schwersten fällt.'}
                </T>
              </Card>
            </>
          ) : null}

          {d.amount ? (
            <>
              <SectionTitle>Menge</SectionTitle>
              <View style={styles.tiles}>
                <StatTile label="Total" value={fmt(d.amount.total)} sub={d.amount.unit} />
                <StatTile
                  label="Schnitt"
                  value={fmt(Math.round(d.amount.average * 10) / 10)}
                  sub={`pro Tag · Ziel ${fmt(d.amount.target)}`}
                />
              </View>
              {d.amount.best ? (
                <T variant="caption" color="textSecondary" center>
                  Bester Tag: {fmt(d.amount.best.value)} {d.amount.unit} am {formatShort(d.amount.best.date)}
                </T>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  icon: { fontSize: 34, lineHeight: 42 },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  card: { gap: Spacing.three },
  strip: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4, maxWidth: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
