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
import { formatNumber, t } from '@/i18n';
import { formatShort, weekdayName, weekdayShortNames } from '@/lib/date';
import { ruleDetail } from '@/lib/rule-stats';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, useAppState } from '@/store/store';

const fmt = (n: number) => formatNumber(n, 1);

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
            {rule.removedOn ? ` · ${t('history.rule.removedOn', { date: formatShort(rule.removedOn) })}` : ''}
          </T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {!started ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">{t('history.rule.noData')}</T>
        </Card>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile
              label={t('history.stats.rate')}
              value={d.expected ? pct(d.rate) : '–'}
              sub={t(d.runUnit === 'Tage' ? 'history.stats.hitsDays' : 'history.stats.hitsUnits', { hits: d.hits, expected: d.expected })}
            />
            <StatTile
              label={t('history.rule.series')}
              value={`${d.currentRun}`}
              sub={t(d.runUnit === 'Tage' ? 'history.rule.runDays' : 'history.rule.runWeeks', { count: d.currentRun, best: d.bestRun })}
            />
          </View>

          {d.recent.length ? (
            <Card style={styles.card}>
              <T variant="label">{t('history.rule.lastDays', { count: d.recent.length })}</T>
              <View style={styles.strip}>
                {d.recent.map((r) => (
                  <View
                    key={r.date}
                    accessibilityLabel={`${formatShort(r.date)}: ${r.hit ? t('history.rule.hit') : t('history.rule.notHit')}`}
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

          <SectionTitle>{t('history.rule.perWeek')}</SectionTitle>
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
              {rule.frequency.kind === 'daily' ? t('history.rule.perWeekDaily') : t('history.rule.perWeekWeekly')} {t('history.rule.tapHint')}
            </T>
          </Card>

          {rule.frequency.kind === 'daily' ? (
            <>
              <SectionTitle>{t('history.rule.weekdays')}</SectionTitle>
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
                    ? t('history.rule.weakest', { day: weekdayName(d.weakestWeekday), rate: pct(d.weekdays[d.weakestWeekday].rate) })
                    : t('history.rule.weakestPending')}
                </T>
              </Card>
            </>
          ) : null}

          {d.amount ? (
            <>
              <SectionTitle>{t('history.rule.amount')}</SectionTitle>
              <View style={styles.tiles}>
                <StatTile label={t('history.rule.total')} value={fmt(d.amount.total)} sub={d.amount.unit} />
                <StatTile
                  label={t('history.rule.average')}
                  value={fmt(Math.round(d.amount.average * 10) / 10)}
                  sub={t('history.rule.perDay', { target: fmt(d.amount.target) })}
                />
              </View>
              {d.amount.best ? (
                <T variant="caption" color="textSecondary" center>
                  {t('history.rule.bestDay', { value: fmt(d.amount.best.value), unit: d.amount.unit, date: formatShort(d.amount.best.date) })}
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
