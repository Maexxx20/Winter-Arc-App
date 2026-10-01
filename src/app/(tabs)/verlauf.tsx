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
import { t } from '@/i18n';
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
        <T variant="display">{t('history.title')}</T>
      </View>

      <View style={styles.tiles}>
        <StatTile label={t('history.stats.held')} value={`${stats.doneDays}`} sub={t('history.stats.ofDays', { count: stats.evaluatedDays })} />
        <StatTile label={t('history.stats.rate')} value={stats.evaluatedDays ? pct(stats.completionRate) : '–'} sub={t('history.stats.allDays')} />
      </View>
      <View style={styles.tiles}>
        <StatTile label={t('history.stats.bestStreak')} value={`${stats.streak.best}`} sub={t('history.stats.current', { count: stats.streak.current })} />
        <StatTile label={t('history.stats.shields')} value={`${stats.shieldedDays}`} sub={t('history.stats.saved')} />
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
        <Button title={t('history.share.title')} variant="secondary" onPress={() => router.push('/teilen')} />
      )}
      <Button title={`📸 ${t('progress.open')}`} variant="secondary" onPress={() => router.push('/fortschritt')} />
      {stats.started && stats.evaluatedDays >= 7 && (
        <Button title={`✨ ${t('recap.openInterim')}`} variant="ghost" small onPress={() => router.push({ pathname: '/arc-rueckblick', params: { id: arc.id } })} />
      )}
      {state.arcs.length > 1 && (
        <Button title={t('history.stats.earlierArcs')} variant="ghost" small onPress={() => router.push('/arcs')} />
      )}

      {weeks.length > 0 && stats.started && (
        <>
          <SectionTitle>{t('history.stats.weeks')}</SectionTitle>
          <View style={styles.weeks}>
            {weeks.map((w) => {
              const r = reviews[w.week];
              return (
                <Pressable
                  key={w.week}
                  onPress={() => router.push({ pathname: '/rueckblick', params: { week: w.week } })}
                  style={({ pressed }) => [styles.weekRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{t('history.stats.week', { index: w.index })}</T>
                    <T variant="caption">
                      {formatShort(w.week)} – {formatShort(addDays(w.week, 6))} · {t('history.stats.weekHeld', { held: w.held, total: w.days.length })}
                    </T>
                  </View>
                  {r ? (
                    <T style={styles.emoji}>{RATING_EMOJI[r.rating]}</T>
                  ) : (
                    <T variant="caption" color="accent">
                      {w.complete ? t('history.stats.review') : t('history.stats.running')}
                    </T>
                  )}
                  <ChevronIcon color={theme.textTertiary} size={16} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <SectionTitle>{t('history.stats.rules')}</SectionTitle>
      <Card style={styles.rules}>
        {stats.ruleStats.map(({ rule, consistency, hits, expected }) => (
          <Pressable
            key={rule.id}
            onPress={() => router.push({ pathname: '/regel/[id]', params: { id: rule.id } })}
            accessibilityRole="button"
            accessibilityLabel={t('history.stats.ruleA11y', { title: rule.title })}
            style={({ pressed }) => [styles.rule, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={styles.ruleHead}>
              <T style={styles.emoji}>{rule.icon}</T>
              <View style={styles.flex}>
                <T variant="bodyStrong" numberOfLines={1}>
                  {rule.title}
                  {rule.removedOn ? <T variant="caption" color="textTertiary">  · {t('history.stats.removed')}</T> : null}
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
              {t(rule.frequency.kind === 'weekly' ? 'history.stats.hitsUnits' : 'history.stats.hitsDays', { hits, expected })}
            </T>
          </Pressable>
        ))}
      </Card>

      <T variant="caption" color="textTertiary" center>
        {t('history.footerHint')}
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
