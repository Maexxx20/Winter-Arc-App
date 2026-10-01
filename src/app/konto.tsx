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
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { openLink, PRIVACY_URL } from '@/constants/links';
import { isReviewEmail, sendLoginCode, signInWithPassword, supabaseConfigured, useSession, verifyLoginCode } from '@/services/supabase';
import { deleteAccount, logout, syncNow, useSyncStatus } from '@/services/sync';

/** «Abgeglichen vor 5 Min.» usw. */
function syncedText(d: Date | null): string {
  if (!d) return t('contract.account.syncedNever');
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return t('contract.account.syncedJustNow');
  if (s < 3600) return t('contract.account.syncedMinutes', { min: Math.round(s / 60) });
  return t('contract.account.syncedAt', { time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` });
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
        <T variant="title">{t('contract.account.title')}</T>
      </View>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
        <CloseIcon color={theme.text} size={16} />
      </Pressable>
    </View>
  );

  if (!supabaseConfigured) {
    return (
      <Screen topInset={Platform.OS !== 'ios'}>
        {header}
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">{t('contract.account.notConfigured')}</T>
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
          <T variant="label">{t('contract.account.signedInAs')}</T>
          <T variant="bodyStrong">{session.user.email}</T>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: sync.state === 'error' ? theme.danger : sync.state === 'syncing' ? theme.shield : theme.accent }]} />
            <T variant="caption" style={styles.flex}>
              {sync.state === 'syncing'
                ? t('contract.account.syncing')
                : sync.state === 'error'
                  ? t('contract.account.syncError', { error: sync.error ?? '' })
                  : syncedText(sync.lastSyncAt)}
            </T>
          </View>
          <Button title={t('contract.account.syncNow')} variant="secondary" small loading={sync.state === 'syncing'} onPress={() => syncNow()} />
        </Card>

        <T variant="caption" color="textTertiary">
          {t('contract.account.backedUp')}
        </T>

        <Button
          title={t('contract.account.signOut')}
          variant="secondary"
          onPress={async () => {
            if (!(await confirm(t('contract.account.signOutTitle'), t('contract.account.signOutBody'), t('contract.account.signOut')))) return;
            await logout();
          }}
        />
        <Button
          title={t('contract.account.delete')}
          variant="danger"
          onPress={async () => {
            if (
              !(await confirm(
                t('contract.account.deleteTitle'),
                t('contract.account.deleteBody'),
                t('contract.account.deleteConfirm'),
                true,
              ))
            )
              return;
            const err = await deleteAccount();
            if (err) await confirm(t('contract.danger.deleteFailed'), err, t('common.ok'));
          }}
        />
      </Screen>
    );
  }

  // ---------- Anmelden ----------
  // Hervorgehobene Teile stehen als {link}/{email} im Text, darum dort aufteilen.
  const [privacyBefore, privacyAfter = ''] = t('contract.account.privacyNote').split('{link}');
  const [codeBefore, codeAfter = ''] = t('contract.account.codeSent').split('{email}');
  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      {header}
      <T color="textSecondary">
        {t('contract.account.intro')}
      </T>

      {step === 'email' ? (
        <>
          <TextField
            label={t('contract.account.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('contract.account.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={() => emailValid && send()}
          />
          {review && (
            <TextField label={t('contract.account.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          )}
          <Button title={review ? t('contract.account.signIn') : t('contract.account.sendCode')} onPress={send} disabled={!emailValid || (review && !password)} loading={busy} />
          <Pressable onPress={() => openLink(PRIVACY_URL)} hitSlop={8}>
            <T variant="caption" color="textTertiary" center>
              {privacyBefore}
              <T variant="caption" color="accent">{t('contract.account.privacyLink')}</T>
              {privacyAfter}
            </T>
          </Pressable>
        </>
      ) : (
        <>
          <T variant="caption">
            {codeBefore}
            <T variant="caption" color="text">{email.trim()}</T>
            {codeAfter}
          </T>
          <TextField
            label={t('contract.account.code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={styles.code}
          />
          <Button title={t('contract.account.signIn')} onPress={verify} disabled={code.length < 6} loading={busy} />
          <Button title={t('contract.account.otherEmail')} variant="ghost" small onPress={() => setStep('email')} />
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
