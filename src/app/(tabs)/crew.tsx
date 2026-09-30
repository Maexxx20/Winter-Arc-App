import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeCode } from '@/lib/crew';
import { haptic } from '@/lib/haptics';
import { createCrew, type CrewWithCount, joinCrew, listCrews } from '@/services/crews';
import { useSession } from '@/services/supabase';
import { updateProfile, useAppState } from '@/store/store';

export default function CrewTab() {
  const theme = useTheme();
  const session = useSession();
  const { settings } = useAppState();
  const [crews, setCrews] = useState<CrewWithCount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [crewName, setCrewName] = useState('');
  const [code, setCode] = useState('');
  const [myName, setMyName] = useState(settings.name);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setCrews(await listCrews());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (myName.trim() !== settings.name) updateProfile({ name: myName.trim() });
      const crew = mode === 'create' ? await createCrew(crewName) : await joinCrew(code);
      haptic.success();
      setMode('none');
      setCrewName('');
      setCode('');
      router.push({ pathname: '/crew/[id]', params: { id: crew.id } });
    } catch (e) {
      haptic.warning();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <View style={styles.head}>
      <T variant="label">Zusammen durchziehen</T>
      <T variant="display">Crew</T>
    </View>
  );

  // ---------- Nicht angemeldet ----------
  if (!session) {
    return (
      <Screen tabs>
        {head}
        <Card style={styles.hero}>
          <T style={styles.heroEmoji}>🏔️</T>
          <T variant="heading" center>
            Niemand besteigt die Nordwand allein.
          </T>
          <T variant="caption" center>
            Mach deinen Arc mit Freunden, Team oder Klasse. Ihr seht, wer seinen Tag gehalten hat, feuert euch mit Reaktionen an
            und vergleicht eure Quote. Jede Person hat ihre eigenen Regeln – geteilt werden nur Zahlen.
          </T>
        </Card>
        <Button title="Anmelden, um loszulegen" onPress={() => router.push('/konto')} />
      </Screen>
    );
  }

  const nameValid = myName.trim().length > 0;
  const canSubmit = nameValid && (mode === 'create' ? crewName.trim().length > 0 : normalizeCode(code).length === 6);

  return (
    <Screen tabs refreshing={loading && crews !== null} onRefresh={load}>
      {head}

      {crews?.length ? (
        <View style={styles.list}>
          {crews.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/crew/[id]', params: { id: c.id } })}
              style={({ pressed }) => [styles.crewRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.crewIcon, { backgroundColor: theme.accentSoft }]}>
                <T style={styles.emoji}>🏔️</T>
              </View>
              <View style={styles.flex}>
                <T variant="bodyStrong">{c.name}</T>
                <T variant="caption">
                  {c.member_count} {c.member_count === 1 ? 'Person' : 'Personen'} · Code {c.invite_code}
                </T>
              </View>
              <ChevronIcon color={theme.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : crews ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" center>
            Du bist noch in keiner Crew. Erstelle eine und lade andere ein – oder tritt mit einem Code bei.
          </T>
        </Card>
      ) : null}

      {mode === 'none' ? (
        <View style={styles.actions}>
          <Button title="Crew erstellen" style={styles.flex} onPress={() => setMode('create')} />
          <Button title="Beitreten" variant="secondary" style={styles.flex} onPress={() => setMode('join')} />
        </View>
      ) : (
        <Card style={styles.form}>
          <SectionTitle>{mode === 'create' ? 'Neue Crew' : 'Crew beitreten'}</SectionTitle>
          {mode === 'create' ? (
            <TextField label="Name der Crew" value={crewName} onChangeText={setCrewName} maxLength={40} placeholder="z. B. Argovia U17" autoFocus />
          ) : (
            <TextField
              label="Einladungscode"
              value={code}
              onChangeText={(v) => setCode(normalizeCode(v))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              style={styles.code}
            />
          )}
          <TextField
            label="So sehen dich die anderen"
            value={myName}
            onChangeText={setMyName}
            maxLength={40}
            placeholder="Dein Name"
          />
          <View style={styles.actions}>
            <Button title="Abbrechen" variant="secondary" style={styles.flex} onPress={() => setMode('none')} />
            <Button title={mode === 'create' ? 'Erstellen' : 'Beitreten'} style={styles.flex} disabled={!canSubmit} loading={busy} onPress={submit} />
          </View>
        </Card>
      )}

      {error ? (
        <T variant="caption" color="danger">
          {error}
        </T>
      ) : null}

      <T variant="caption" color="textTertiary" center>
        Deine Crew sieht nur, ob du deinen Tag gehalten hast, deinen Streak und deine Quote – keine Regeln, Notizen oder Fotos.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  hero: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.eight },
  heroEmoji: { fontSize: 44, lineHeight: 52 },
  list: { gap: Spacing.two },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingRight: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  crewIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  form: { gap: Spacing.four },
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
});
