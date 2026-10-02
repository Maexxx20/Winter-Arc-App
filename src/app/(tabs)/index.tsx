import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ArcGauge } from '@/components/arc-gauge';
import { ChevronIcon, FlameIcon, ShieldIcon } from '@/components/icons';
import { ProfileButton } from '@/components/profile-button';
import { ReminderPrompt } from '@/components/reminder-prompt';
import { RuleRow } from '@/components/rule-row';
import { StatTile } from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { activeRules, arcPhase, computeStats, dayProgress, dueReviewWeek, ruleValue, weeklyCount } from '@/lib/arc';
import { diffDays, formatLong, formatShort } from '@/lib/date';
import { nextSeason } from '@/lib/seasons';
import { t } from '@/i18n';
import { syncHealthNow } from '@/services/health-sync';
import { syncNow } from '@/services/sync';
import { widgetsAvailable } from '@/services/widget';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, selectReviews, setRuleValue, updateSettings, useAppState } from '@/store/store';

export default function TodayScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);

  const stats = useMemo(() => (arc ? computeStats(arc, log, today) : null), [arc, log, today]);
  const [refreshing, setRefreshing] = useState(false);

  // Beim Öffnen des Tabs verknüpfte Regeln aus Health/Strava nachziehen.
  useFocusEffect(
    useCallback(() => {
      syncHealthNow().catch(() => undefined);
    }, []),
  );
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([syncHealthNow(true).catch(() => 0), syncNow().catch(() => undefined)]);
    setRefreshing(false);
  };

  if (!arc || !stats) return null;

  const progress = dayProgress(arc, log, today);
  const rules = activeRules(arc, today);
  const daily = rules.filter((r) => r.frequency.kind === 'daily');
  const weekly = rules.filter((r) => r.frequency.kind === 'weekly');
  const phase = arcPhase(stats);
  const allDone = progress.total > 0 && progress.done === progress.total;
  const firstName = state.settings.name.split(' ')[0];

  // ---------- Vor dem Start ----------
  if (!stats.started) {
    const inDays = diffDays(today, arc.startDate);
    return (
      <Screen tabs>
        <View style={styles.headRow}>
          <View style={[styles.head, styles.flex]}>
            <T variant="label">{formatLong(today)}</T>
            <T variant="display">{firstName ? t('today.screen.readyName', { name: firstName }) : t('today.screen.ready')}</T>
          </View>
          <ProfileButton />
        </View>
        <Card style={styles.countdown}>
          <T variant="label" color="accent">{t('today.screen.startOn', { date: formatShort(arc.startDate) })}</T>
          <T variant="hero">{inDays}</T>
          <T color="textSecondary">{t('today.screen.daysToStart', { count: inDays })}</T>
        </Card>
        <ReminderPrompt />
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="bodyStrong">{phase.title}</T>
          <T variant="caption">{phase.hint}</T>
        </Card>
        <SectionTitle>{t('today.screen.yourRules')}</SectionTitle>
        {arc.rules.filter((r) => !r.removedOn).map((r) => (
          <View key={r.id} style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <T style={styles.emoji}>{r.icon}</T>
            <View style={styles.flex}>
              <T variant="bodyStrong">{r.title}</T>
              <T variant="caption">{describeRule(r)}</T>
            </View>
          </View>
        ))}
      </Screen>
    );
  }

  // ---------- Nach dem Ende ----------
  if (stats.finished) {
    const next = nextSeason(arc.endDate);
    return (
      <Screen tabs>
        <View style={styles.headRow}>
          <View style={[styles.head, styles.flex]}>
            <T variant="label">{arc.title}</T>
            <T variant="display">{t('today.screen.finished')}</T>
          </View>
          <ProfileButton />
        </View>
        <Card style={styles.countdown}>
          <T variant="label" color="accent">{t('today.screen.daysHeld')}</T>
          <T variant="hero">{stats.doneDays}</T>
          <T color="textSecondary">{t('today.screen.ofTotal', { total: stats.totalDays, percent: Math.round(stats.completionRate * 100) })}</T>
        </Card>
        <View style={styles.tiles}>
          <StatTile label={t('today.screen.bestStreak')} value={`${stats.streak.best}`} sub={t('today.screen.inARow')} />
          <StatTile label={t('today.screen.shields')} value={`${stats.shieldedDays}`} sub={t('today.screen.saved')} />
        </View>
        <Button title={`✨ ${t('recap.open')}`} onPress={() => router.push({ pathname: '/arc-rueckblick', params: { id: arc.id } })} />
        <Card tone="accentSoft" bordered={false} style={styles.next}>
          <T variant="label" color="accent">{t('today.screen.whatsNext')}</T>
          <T variant="heading">
            {next.season.icon} {t('today.screen.nextFrom', { title: next.title, date: formatShort(next.startDate) })}
          </T>
          <T variant="caption">
            {t('today.screen.nextHint', { title: arc.title })}
          </T>
          <Button title={t('today.screen.takeRules')} variant="secondary" onPress={() => router.push({ pathname: '/onboarding/create', params: { from: arc.id } })} />
          <Button title={t('today.screen.startFresh')} variant="secondary" onPress={() => router.push('/onboarding/create')} />
        </Card>
      </Screen>
    );
  }

  // ---------- Laufender Arc ----------
  const streakDays = stats.streak.current;
  const reviewWeek = dueReviewWeek(arc, today, selectReviews(state, arc.id));
  // Einmaliger Hinweis aufs Widget ab Tag 2 (nicht im Browser und nicht in Expo Go – dort gibt es keine Widgets)
  const showWidgetHint = !state.settings.widgetHintSeen && stats.dayNumber >= 2 && widgetsAvailable();

  return (
    <Screen tabs refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.headRow}>
        <View style={[styles.head, styles.flex]}>
          <T variant="label">{formatLong(today)}</T>
          <T variant="title">{arc.title}</T>
        </View>
        <ProfileButton />
      </View>

      <View style={styles.gaugeWrap}>
        <ArcGauge progress={stats.dayNumber / stats.totalDays} today={progress.ratio} dayNumber={stats.dayNumber} totalDays={stats.totalDays} />
        <T variant="caption" center style={styles.gaugeCaption}>
          {allDone
            ? t('today.screen.heldToday')
            : t('today.screen.progress', { done: progress.done, total: progress.total, count: stats.daysLeft })}
        </T>
      </View>

      <View style={styles.tiles}>
        <StatTile label={t('today.screen.streak')} value={`${streakDays}`} sub={t('today.screen.record', { best: stats.streak.best })} icon={<FlameIcon color={streakDays > 0 ? theme.accent : theme.textTertiary} size={16} />} />
        <StatTile
          label={t('today.screen.shield')}
          value={stats.streak.shieldAvailable ? '1/1' : '0/1'}
          sub={t('today.screen.left')}
          icon={<ShieldIcon color={theme.shield} size={16} filled={stats.streak.shieldAvailable} />}
        />
        <StatTile label={t('today.screen.rate')} value={stats.evaluatedDays ? `${Math.round(stats.completionRate * 100)}%` : '–'} sub={t('today.screen.held')} />
      </View>

      <ReminderPrompt />

      {showWidgetHint && (
        <Card tone="surfaceMuted" bordered={false} style={styles.alert}>
          <T variant="bodyStrong">{t('extras.widgetHint.title')}</T>
          <T variant="caption">{Platform.OS === 'ios' ? t('extras.widgetHint.ios') : t('extras.widgetHint.android')}</T>
          <Button title={t('extras.widgetHint.ok')} variant="ghost" small onPress={() => updateSettings({ widgetHintSeen: true })} />
        </Card>
      )}

      {reviewWeek && (
        <Pressable
          onPress={() => router.push({ pathname: '/rueckblick', params: { week: reviewWeek } })}
          style={({ pressed }) => [styles.noteRow, { backgroundColor: theme.accentSoft, borderColor: theme.accent, opacity: pressed ? 0.8 : 1, marginTop: 0 }]}>
          <T style={styles.emoji}>🗓️</T>
          <View style={styles.flex}>
            <T variant="bodyStrong" color="accent">{t('today.screen.weeklyReview')}</T>
            <T variant="caption">{t('today.screen.weeklyReviewHint')}</T>
          </View>
          <ChevronIcon color={theme.accent} />
        </Pressable>
      )}

      {stats.streak.onThinIce && !allDone && (
        <Card tone="warningSoft" bordered={false} style={styles.alert}>
          <T variant="bodyStrong" color="warning">{t('today.screen.thinIce')}</T>
          <T variant="caption" color="warning">
            {t('today.screen.thinIceHint')}
          </T>
        </Card>
      )}

      <SectionTitle action={<T variant="caption">{progress.done}/{progress.total}</T>}>{t('date.today')}</SectionTitle>
      <View style={styles.list}>
        {daily.map((r) => (
          <RuleRow key={r.id} rule={r} value={ruleValue(log, today, r.id)} onChange={(v) => setRuleValue(arc.id, today, r.id, v)} />
        ))}
      </View>

      {weekly.length > 0 && (
        <>
          <SectionTitle>{t('today.screen.thisWeek')}</SectionTitle>
          <View style={styles.list}>
            {weekly.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                value={ruleValue(log, today, r.id)}
                weekCount={weeklyCount(arc, log, r, today)}
                onChange={(v) => setRuleValue(arc.id, today, r.id, v)}
              />
            ))}
          </View>
        </>
      )}

      <Pressable
        onPress={() => router.push({ pathname: '/tag/[date]', params: { date: today } })}
        style={({ pressed }) => [styles.noteRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
        <T style={styles.emoji}>📝</T>
        <View style={styles.flex}>
          <T variant="bodyStrong">{log[today]?.note ? t('today.screen.noteToday') : t('today.screen.noteDay')}</T>
          <T variant="caption" numberOfLines={1}>
            {log[today]?.note ?? t('today.screen.notePlaceholder')}
          </T>
        </View>
        <ChevronIcon color={theme.textTertiary} />
      </Pressable>

      <Card tone="surfaceMuted" bordered={false} style={styles.phase}>
        <T variant="label" color="accent">{t('today.screen.phase', { title: phase.title })}</T>
        <T variant="caption">{phase.hint}</T>
        {stats.daysToHabit > 0 ? (
          <T variant="caption" color="textTertiary">
            {t('today.screen.toHabit', { count: stats.daysToHabit })}
          </T>
        ) : (
          <T variant="caption" color="accent">{t('today.screen.habitReached')}</T>
        )}
      </Card>

      {arc.why ? (
        <View style={styles.why}>
          <T variant="label">{t('today.screen.yourWhy')}</T>
          <T color="textSecondary" style={styles.whyText}>{t('today.screen.whyQuote', { why: arc.why })}</T>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  next: { gap: Spacing.three },
  head: { gap: 2 },
  gaugeWrap: { alignItems: 'center', marginTop: Spacing.two },
  gaugeCaption: { marginTop: Spacing.one },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  alert: { gap: 2 },
  list: { gap: Spacing.two },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingRight: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  emoji: { fontSize: 22, lineHeight: 28 },
  flex: { flex: 1 },
  phase: { gap: 4 },
  why: { gap: 4, paddingHorizontal: Spacing.one, marginTop: Spacing.two },
  whyText: { fontStyle: 'italic' },
  countdown: { alignItems: 'center', gap: 2, paddingVertical: Spacing.eight },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
