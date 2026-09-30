import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { syncHealthNow } from '@/services/health-sync';
import { syncNow } from '@/services/sync';
import { describeRule } from '@/lib/templates';
import { selectActiveArc, selectLog, selectReviews, setRuleValue, useAppState } from '@/store/store';

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
            <T variant="display">{firstName ? `Bereit, ${firstName}?` : 'Bereit?'}</T>
          </View>
          <ProfileButton />
        </View>
        <Card style={styles.countdown}>
          <T variant="label" color="accent">Start am {formatShort(arc.startDate)}</T>
          <T variant="hero">{inDays}</T>
          <T color="textSecondary">{inDays === 1 ? 'Tag bis zum Start' : 'Tage bis zum Start'}</T>
        </Card>
        <ReminderPrompt />
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="bodyStrong">{phase.title}</T>
          <T variant="caption">{phase.hint}</T>
        </Card>
        <SectionTitle>Deine Regeln</SectionTitle>
        {arc.rules.filter((r) => !r.removedOn).map((r) => (
          <View key={r.id} style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <T style={styles.emoji}>{r.icon}</T>
            <View style={styles.flex}>
              <T variant="bodyStrong">{r.title}</T>
              <T variant="caption">{describeRule(r)}</T>
            </View>
          </View>
        ))}
        <T variant="caption" color="textTertiary" center>
          Vor dem Start kannst du deine Regeln im Tab «Vertrag» noch frei anpassen.
        </T>
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
            <T variant="display">Arc abgeschlossen.</T>
          </View>
          <ProfileButton />
        </View>
        <Card style={styles.countdown}>
          <T variant="label" color="accent">Gehaltene Tage</T>
          <T variant="hero">{stats.doneDays}</T>
          <T color="textSecondary">von {stats.totalDays} · {Math.round(stats.completionRate * 100)} %</T>
        </Card>
        <View style={styles.tiles}>
          <StatTile label="Bester Streak" value={`${stats.streak.best}`} sub="Tage am Stück" />
          <StatTile label="Schilde" value={`${stats.shieldedDays}`} sub="Tage gerettet" />
        </View>
        <Card tone="accentSoft" bordered={false} style={styles.next}>
          <T variant="label" color="accent">Wie geht es weiter?</T>
          <T variant="heading">
            {next.season.icon} {next.title} · ab {formatShort(next.startDate)}
          </T>
          <T variant="caption">
            Nimm deine Regeln mit in den nächsten Arc – oder fang mit neuen an. Dein {arc.title} bleibt im Verlauf.
          </T>
          <Button title="Regeln mitnehmen" onPress={() => router.push({ pathname: '/onboarding/create', params: { from: arc.id } })} />
          <Button title="Neu beginnen" variant="secondary" onPress={() => router.push('/onboarding/create')} />
        </Card>
        <Button title="Rückblick ansehen" variant="ghost" onPress={() => router.push('/verlauf')} />
      </Screen>
    );
  }

  // ---------- Laufender Arc ----------
  const streakDays = stats.streak.current;
  const reviewWeek = dueReviewWeek(arc, today, selectReviews(state, arc.id));

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
            ? 'Heute gehalten. Stark.'
            : `${progress.done} von ${progress.total} erledigt · noch ${stats.daysLeft} ${stats.daysLeft === 1 ? 'Tag' : 'Tage'}`}
        </T>
      </View>

      <View style={styles.tiles}>
        <StatTile label="Streak" value={`${streakDays}`} sub={`Rekord ${stats.streak.best}`} icon={<FlameIcon color={streakDays > 0 ? theme.accent : theme.textTertiary} size={16} />} />
        <StatTile
          label="Schild"
          value={stats.streak.shieldAvailable ? '1/1' : '0/1'}
          sub="übrig"
          icon={<ShieldIcon color={theme.shield} size={16} filled={stats.streak.shieldAvailable} />}
        />
        <StatTile label="Quote" value={stats.evaluatedDays ? `${Math.round(stats.completionRate * 100)}%` : '–'} sub="gehalten" />
      </View>

      <ReminderPrompt />

      {reviewWeek && (
        <Pressable
          onPress={() => router.push({ pathname: '/rueckblick', params: { week: reviewWeek } })}
          style={({ pressed }) => [styles.noteRow, { backgroundColor: theme.accentSoft, borderColor: theme.accent, opacity: pressed ? 0.8 : 1, marginTop: 0 }]}>
          <T style={styles.emoji}>🗓️</T>
          <View style={styles.flex}>
            <T variant="bodyStrong" color="accent">Wochenrückblick</T>
            <T variant="caption">Zwei Minuten: Was lief gut, was nimmst du dir vor?</T>
          </View>
          <ChevronIcon color={theme.accent} />
        </Pressable>
      )}

      {stats.streak.onThinIce && !allDone && (
        <Card tone="warningSoft" bordered={false} style={styles.alert}>
          <T variant="bodyStrong" color="warning">Dünnes Eis</T>
          <T variant="caption" color="warning">
            Gestern hast du verpasst. Kein Problem – aber heute zählt. Nie zweimal hintereinander.
          </T>
        </Card>
      )}

      <SectionTitle action={<T variant="caption">{progress.done}/{progress.total}</T>}>Heute</SectionTitle>
      <View style={styles.list}>
        {daily.map((r) => (
          <RuleRow key={r.id} rule={r} value={ruleValue(log, today, r.id)} onChange={(v) => setRuleValue(arc.id, today, r.id, v)} />
        ))}
      </View>

      {weekly.length > 0 && (
        <>
          <SectionTitle>Diese Woche</SectionTitle>
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
          <T variant="bodyStrong">{log[today]?.note ? 'Notiz von heute' : 'Notiz zum Tag'}</T>
          <T variant="caption" numberOfLines={1}>
            {log[today]?.note ?? 'Wie lief es? Was hat geholfen?'}
          </T>
        </View>
        <ChevronIcon color={theme.textTertiary} />
      </Pressable>

      <Card tone="surfaceMuted" bordered={false} style={styles.phase}>
        <T variant="label" color="accent">Phase · {phase.title}</T>
        <T variant="caption">{phase.hint}</T>
        {stats.daysToHabit > 0 ? (
          <T variant="caption" color="textTertiary">
            Noch {stats.daysToHabit} Tage Streak bis zur 66-Tage-Marke.
          </T>
        ) : (
          <T variant="caption" color="accent">66-Tage-Marke erreicht. Das ist jetzt Gewohnheit.</T>
        )}
      </Card>

      {arc.why ? (
        <View style={styles.why}>
          <T variant="label">Dein Warum</T>
          <T color="textSecondary" style={styles.whyText}>«{arc.why}»</T>
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
