import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Segmented, Stepper } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
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
    if (!crew || !(await confirm('Challenge löschen?', 'Die Challenge dieser Woche wird für alle entfernt.', 'Löschen', true))) return;
    try {
      await deleteChallenge(crew, week);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">{detail?.crew.name ?? 'Crew'}</T>
          <T variant="title">Wochen-Challenge</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      <T color="textSecondary">
        Gilt für diese Woche, {formatShort(week)} bis {formatShort(addDays(week, 6))}. Es zählt, wer diese Woche mitmacht.
      </T>

      <Segmented
        options={[
          { value: 'crew_total', label: 'Zusammen' },
          { value: 'everyone', label: 'Jede:r' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setTarget(defaultChallengeTarget(k, memberCount));
        }}
      />

      <Card style={styles.card}>
        <T variant="bodyStrong">
          {kind === 'crew_total' ? 'Wie viele gehaltene Tage schafft ihr zusammen?' : 'Wie viele Tage hält jede Person mindestens?'}
        </T>
        <Stepper value={Math.min(target, max)} onChange={setTarget} min={1} max={max} format={(v) => `${v} ${v === 1 ? 'Tag' : 'Tage'}`} />
        <T variant="caption" color="textTertiary">
          {kind === 'crew_total'
            ? `${memberCount} ${memberCount === 1 ? 'Person' : 'Personen'} × 7 Tage = höchstens ${memberCount * 7}.`
            : 'Geschafft, wenn alle, die diese Woche dabei sind, das Ziel erreichen.'}
        </T>
      </Card>

      <Card tone="accentSoft" bordered={false}>
        <T variant="label" color="accent">Vorschau</T>
        <T variant="heading">{challengeTitle({ kind, target: Math.min(target, max) })}</T>
      </Card>

      {error ? <T variant="caption" color="danger">{error}</T> : null}

      <Button title={existing ? 'Speichern' : 'Challenge starten'} onPress={save} loading={busy} disabled={!detail} />
      {existing ? <Button title="Challenge löschen" variant="ghost" small onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { gap: Spacing.three },
});
