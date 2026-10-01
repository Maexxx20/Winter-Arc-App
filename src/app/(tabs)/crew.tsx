import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { normalizeCode } from '@/lib/crew';
import { haptic } from '@/lib/haptics';
import { createCrew, type CrewWithCount, joinCrew, listCrews } from '@/services/crews';
import { pushProblemText, setCrewPush } from '@/services/push';
import { useSession } from '@/services/supabase';
import { updateProfile, updateSettings, useAppState } from '@/store/store';

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
      <T variant="label">{t('crew.tab.kicker')}</T>
      <T variant="display">{t('crew.title')}</T>
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
            {t('crew.tab.heroTitle')}
          </T>
          <T variant="caption" center>
            {t('crew.tab.heroText')}
          </T>
        </Card>
        <Button title={t('crew.tab.signIn')} onPress={() => router.push('/konto')} />
      </Screen>
    );
  }

  const nameValid = myName.trim().length > 0;
  const canSubmit = nameValid && (mode === 'create' ? crewName.trim().length > 0 : normalizeCode(code).length === 6);

  return (
    <Screen tabs refreshing={loading && crews !== null} onRefresh={load}>
      {head}

      {Platform.OS !== 'web' && settings.crewPush === null && !!crews?.length ? (
        <Card tone="accentSoft" bordered={false} style={styles.form}>
          <T variant="bodyStrong">{t('crew.tab.pushTitle')}</T>
          <T variant="caption">{t('crew.tab.pushText')}</T>
          <View style={styles.actions}>
            <Button title={t('crew.tab.pushNo')} variant="secondary" small style={styles.flex} onPress={() => updateSettings({ crewPush: false })} />
            <Button
              title={t('crew.tab.pushYes')}
              small
              style={styles.flex}
              onPress={async () => {
                const problem = await setCrewPush(true);
                if (problem) setError(pushProblemText(problem));
              }}
            />
          </View>
        </Card>
      ) : null}

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
                  {t('crew.tab.crewMeta', { people: t('crew.people', { count: c.member_count }), code: c.invite_code })}
                </T>
              </View>
              <ChevronIcon color={theme.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : crews ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" center>
            {t('crew.tab.empty')}
          </T>
        </Card>
      ) : null}

      {mode === 'none' ? (
        <View style={styles.actions}>
          <Button title={t('crew.tab.create')} style={styles.flex} onPress={() => setMode('create')} />
          <Button title={t('crew.form.join')} variant="secondary" style={styles.flex} onPress={() => setMode('join')} />
        </View>
      ) : (
        <Card style={styles.form}>
          <SectionTitle>{mode === 'create' ? t('crew.tab.newCrew') : t('crew.form.joinTitle')}</SectionTitle>
          {mode === 'create' ? (
            <TextField label={t('crew.tab.crewName')} value={crewName} onChangeText={setCrewName} maxLength={40} placeholder={t('crew.tab.crewNamePlaceholder')} autoFocus />
          ) : (
            <TextField
              label={t('crew.form.code')}
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
            label={t('crew.form.displayName')}
            value={myName}
            onChangeText={setMyName}
            maxLength={40}
            placeholder={t('crew.form.namePlaceholder')}
          />
          <View style={styles.actions}>
            <Button title={t('common.cancel')} variant="secondary" style={styles.flex} onPress={() => setMode('none')} />
            <Button title={mode === 'create' ? t('crew.tab.createButton') : t('crew.form.join')} style={styles.flex} disabled={!canSubmit} loading={busy} onPress={submit} />
          </View>
        </Card>
      )}

      {error ? (
        <T variant="caption" color="danger">
          {error}
        </T>
      ) : null}

      <T variant="caption" color="textTertiary" center>
        {t('crew.tab.privacy')}
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
