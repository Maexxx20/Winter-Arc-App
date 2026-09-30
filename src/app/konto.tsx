import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { openLink, PRIVACY_URL } from '@/constants/links';
import { isReviewEmail, sendLoginCode, signInWithPassword, signOut, supabaseConfigured, useSession, verifyLoginCode } from '@/services/supabase';
import { deleteAccount, syncNow, useSyncStatus } from '@/services/sync';
import { setSyncMeta } from '@/store/store';

function timeAgo(d: Date | null): string {
  if (!d) return 'noch nie';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  return `um ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AccountScreen() {
  const theme = useTheme();
  const session = useSession();
  const sync = useSyncStatus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const review = isReviewEmail(email);

  const send = async () => {
    setBusy(true);
    setError(null);
    const err = review ? await signInWithPassword(email, password) : await sendLoginCode(email);
    if (review) {
      setBusy(false);
      if (err) setError(err);
      return;
    }
    setBusy(false);
    if (err) setError(err);
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const err = await verifyLoginCode(email, code);
    setBusy(false);
    if (err) {
      haptic.warning();
      setError(err);
    } else {
      haptic.success();
      setCode('');
      setStep('email');
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <T variant="label">Nordwand</T>
        <T variant="title">Konto & Sync</T>
      </View>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
        <CloseIcon color={theme.text} size={16} />
      </Pressable>
    </View>
  );

  if (!supabaseConfigured) {
    return (
      <Screen topInset={Platform.OS !== 'ios'}>
        {header}
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">Der Sync ist in dieser Version noch nicht eingerichtet. Deine Daten liegen sicher auf diesem Gerät.</T>
        </Card>
      </Screen>
    );
  }

  // ---------- Angemeldet ----------
  if (session) {
    return (
      <Screen topInset={Platform.OS !== 'ios'}>
        {header}
        <Card style={styles.card}>
          <T variant="label">Angemeldet als</T>
          <T variant="bodyStrong">{session.user.email}</T>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: sync.state === 'error' ? theme.danger : sync.state === 'syncing' ? theme.shield : theme.accent }]} />
            <T variant="caption" style={styles.flex}>
              {sync.state === 'syncing'
                ? 'Wird abgeglichen …'
                : sync.state === 'error'
                  ? `Fehler beim Abgleich: ${sync.error}`
                  : `Abgeglichen ${timeAgo(sync.lastSyncAt)}`}
            </T>
          </View>
          <Button title="Jetzt abgleichen" variant="secondary" small loading={sync.state === 'syncing'} onPress={() => syncNow()} />
        </Card>

        <T variant="caption" color="textTertiary">
          Arcs, Häkchen, Notizen und Wochenrückblicke werden gesichert. Fotos bleiben vorerst nur auf diesem Gerät.
        </T>

        <Button
          title="Abmelden"
          variant="secondary"
          onPress={async () => {
            if (!(await confirm('Abmelden?', 'Deine Daten bleiben auf diesem Gerät und im Konto gespeichert.', 'Abmelden'))) return;
            await syncNow();
            await signOut();
            setSyncMeta({ userId: null, lastPushedAt: null, lastPulledAt: null });
          }}
        />
        <Button
          title="Konto löschen"
          variant="danger"
          onPress={async () => {
            if (
              !(await confirm(
                'Konto löschen?',
                'Dein Konto und alle Daten auf dem Server werden endgültig gelöscht. Die Daten auf diesem Gerät bleiben.',
                'Endgültig löschen',
                true,
              ))
            )
              return;
            const err = await deleteAccount();
            if (err) await confirm('Löschen fehlgeschlagen', err, 'OK');
          }}
        />
      </Screen>
    );
  }

  // ---------- Anmelden ----------
  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      {header}
      <T color="textSecondary">
        Sichere deinen Arc und nutze ihn auf mehreren Geräten. Kein Passwort – du bekommst einen Code per E-Mail.
      </T>

      {step === 'email' ? (
        <>
          <TextField
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            placeholder="du@beispiel.ch"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={() => emailValid && send()}
          />
          {review && (
            <TextField label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          )}
          <Button title={review ? 'Anmelden' : 'Code senden'} onPress={send} disabled={!emailValid || (review && !password)} loading={busy} />
          <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
            <T variant="caption" color="textTertiary" center>
              Mit der Anmeldung gilt unsere <T variant="caption" color="accent">Datenschutzerklärung</T>.
            </T>
          </Pressable>
        </>
      ) : (
        <>
          <T variant="caption">
            Wir haben dir einen Code an <T variant="caption" color="text">{email.trim()}</T> geschickt.
          </T>
          <TextField
            label="Code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={styles.code}
          />
          <Button title="Anmelden" onPress={verify} disabled={code.length < 6} loading={busy} />
          <Button title="Andere E-Mail" variant="ghost" small onPress={() => setStep('email')} />
        </>
      )}

      {error ? (
        <T variant="caption" color="danger">
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { gap: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
