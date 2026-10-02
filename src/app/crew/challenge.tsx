import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented, Stepper } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { type ChallengeKind, challengeTitle, defaultChallengeTarget } from '@/lib/crew';
import { addDays, formatShort, weekStart } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { cachedCrew, type CrewDetail, deleteChallenge, loadCrew, saveChallenge } from '@/services/crews';

/** Wochen-Challenge starten oder ändern. */
export default function ChallengeScreen() {
  const theme = useTheme();
  const today = useToday();
  const { crew } = useLocalSearchParams<{ crew: string }>();
  const [detail, setDetail] = useState<CrewDetail | undefined>(() => (crew ? cachedCrew(crew) : undefined));
  const week = weekStart(today);
  const existing = detail?.challenges.find((c) => c.week === week);
  const memberCount = Math.max(1, detail?.members.length ?? 1);

  const [kind, setKind] = useState<ChallengeKind>(existing?.kind ?? 'crew_total');
  const [target, setTarget] = useState(existing?.target ?? defaultChallengeTarget('crew_total', memberCount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direkt geöffnet (z. B. nach Neustart): Crew erst laden, dann Formular füllen.
  useEffect(() => {
    if (detail || !crew) return;
    loadCrew(crew, today)
      .then((d) => {
        setDetail(d);
        const ex = d.challenges.find((c) => c.week === week);
        setKind(ex?.kind ?? 'crew_total');
        setTarget(ex?.target ?? defaultChallengeTarget(ex?.kind ?? 'crew_total', d.members.length));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [detail, crew, today, week]);

  const max = kind === 'crew_total' ? Math.min(140, memberCount * 7) : 7;

  const save = async () => {
    if (!crew) return;
    setBusy(true);
    setError(null);
    try {
      await saveChallenge(crew, week, kind, Math.min(target, max), !!existing);
      haptic.success();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!crew || !(await confirm(t('crew.challenge.deleteTitle'), t('crew.challenge.deleteText'), t('common.delete'), true))) return;
    try {
      await deleteChallenge(crew, week);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <ScreenHeader>
        <View style={styles.flex}>
          <T variant="label">{detail?.crew.name ?? t('crew.title')}</T>
          <T variant="title">{t('crew.challenge.label')}</T>
        </View>
      </ScreenHeader>

      <T color="textSecondary">
        {t('crew.challenge.period', { from: formatShort(week), to: formatShort(addDays(week, 6)) })}
      </T>

      <Segmented
        options={[
          { value: 'crew_total', label: t('crew.challenge.kindTotal') },
          { value: 'everyone', label: t('crew.challenge.kindEveryone') },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setTarget(defaultChallengeTarget(k, memberCount));
        }}
      />

      <Card style={styles.card}>
        <T variant="bodyStrong">
          {kind === 'crew_total' ? t('crew.challenge.questionTotal') : t('crew.challenge.questionEveryone')}
        </T>
        <Stepper value={Math.min(target, max)} onChange={setTarget} min={1} max={max} format={(v) => t('common.days', { count: v })} />
      </Card>

      <Card tone="accentSoft" bordered={false}>
        <T variant="label" color="accent">{t('crew.challenge.preview')}</T>
        <T variant="heading">{challengeTitle({ kind, target: Math.min(target, max) })}</T>
      </Card>

      {error ? <T variant="caption" color="danger">{error}</T> : null}

      <Button title={existing ? t('common.save') : t('crew.challenge.start')} onPress={save} loading={busy} disabled={!detail} />
      {existing ? <Button title={t('crew.challenge.delete')} variant="ghost" small onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { gap: Spacing.three },
});
