import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { MyAvatar } from '@/components/avatar';
import { BadgeGrid } from '@/components/badge';
import { ChevronIcon } from '@/components/icons';
import { StatTile } from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BlockedList } from '@/components/blocked-list';
import { SettingsSections } from '@/components/settings-sections';
import { SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { T } from '@/components/ui/text';
import { openLink } from '@/constants/links';
import { Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { computeStats } from '@/lib/arc';
import { BADGES, badgeSummary } from '@/lib/badges';
import { useBadges } from '@/hooks/use-badges';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { pickAvatar } from '@/services/avatar-file';
import { isObjectionable } from '@/lib/moderation';
import { cleanInstagram, instagramUrl } from '@/lib/profile';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { logout, useSyncStatus } from '@/services/sync';
import { selectActiveArc, setAvatar, updateProfile, useAppState } from '@/store/store';

type AvatarAction = 'camera' | 'library' | 'remove' | null;
type Field = 'name' | 'motto' | 'instagram';

function chooseAvatarAction(hasImage: boolean): Promise<AvatarAction> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress: () => void }[] = [
      { text: t('contract.profile.takePhoto'), onPress: () => resolve('camera') },
      { text: t('contract.profile.fromLibrary'), onPress: () => resolve('library') },
    ];
    if (hasImage) buttons.push({ text: t('contract.profile.removeImage'), style: 'destructive', onPress: () => resolve('remove') });
    buttons.push({ text: t('common.cancel'), style: 'cancel', onPress: () => resolve(null) });
    Alert.alert(t('contract.profile.avatar'), undefined, buttons, { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export default function ProfileScreen() {
  const theme = useTheme();
  const state = useAppState();
  const today = useToday();
  const session = useSession();
  const sync = useSyncStatus();
  const { settings } = state;

  const [name, setName] = useState(settings.name);
  const [motto, setMotto] = useState(settings.motto);
  const [instagram, setInstagram] = useState(settings.instagram);
  const [editing, setEditing] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);

  // Neuer Stand vom Server (z. B. nach dem Anmelden): Felder nachziehen, ausser dem, das gerade bearbeitet wird.
  useEffect(() => {
    if (editing !== 'name') setName(settings.name);
    if (editing !== 'motto') setMotto(settings.motto);
    if (editing !== 'instagram') setInstagram(settings.instagram);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.name, settings.motto, settings.instagram]);

  const earnedBadges = useBadges();
  const badges = useMemo(() => badgeSummary(earnedBadges), [earnedBadges]);

  const hasImage = !!(settings.avatar.local || settings.avatar.remote);

  const stats = useMemo(() => {
    const started = state.arcs.filter((a) => a.startDate <= today);
    let held = 0;
    let best = 0;
    for (const arc of started) {
      const s = computeStats(arc, state.logs[arc.id] ?? {}, today);
      held += s.doneDays;
      best = Math.max(best, s.streak.best);
    }
    const active = selectActiveArc(state);
    const activeStats = active && active.startDate <= today ? computeStats(active, state.logs[active.id] ?? {}, today) : null;
    return { arcs: started.length, held, best, active: activeStats };
  }, [state, today]);

  const changeImage = async () => {
    const action = await chooseAvatarAction(hasImage);
    if (!action) return;
    if (action === 'remove') {
      setAvatar(null);
      return;
    }
    setBusy(true);
    try {
      const file = await pickAvatar(action);
      if (file) {
        setAvatar(file);
        haptic.success();
      }
    } catch (e) {
      await confirm(t('contract.profile.imageNotSaved'), e instanceof Error ? e.message : String(e), t('common.ok'));
    } finally {
      setBusy(false);
    }
  };

  /** Nur speichern, was wirklich geändert wurde – sonst würde ein alter Wert einen neueren überschreiben. */
  const commit = (field: Field, value: string) => {
    setEditing(null);
    if (field === 'name' && !value) {
      setName(settings.name);
      return;
    }
    if (isObjectionable(value)) {
      // Zurück auf den gespeicherten Wert
      if (field === 'name') setName(settings.name);
      else if (field === 'motto') setMotto(settings.motto);
      else setInstagram(settings.instagram);
      confirm(t('common.error'), t('system.moderation.blocked'), t('common.ok'));
      return;
    }
    if (value !== settings[field]) updateProfile({ [field]: value });
  };

  const shownName = name.trim() || t('contract.profile.yourName');

  return (
    <Screen>
      <ScreenHeader>
        <View style={styles.flex}>
          <T variant="label">Nordwand</T>
          <T variant="title">{t('contract.profile.title')}</T>
        </View>
      </ScreenHeader>

      {/* Kopf: Bild, Name, Motto */}
      <View style={styles.hero}>
        <Pressable onPress={changeImage} accessibilityRole="button" accessibilityLabel={t('contract.profile.changeA11y')} disabled={busy}>
          <View>
            <MyAvatar size={112} />
            {busy && (
              <View style={[styles.busy, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
        </Pressable>
        <View style={styles.imageActions}>
          <Pressable onPress={changeImage} hitSlop={8} disabled={busy}>
            <T variant="caption" color="accent">{hasImage ? t('contract.profile.changeImage') : t('contract.profile.addImage')}</T>
          </Pressable>
          {Platform.OS === 'web' && hasImage ? (
            <Pressable onPress={() => setAvatar(null)} hitSlop={8}>
              <T variant="caption" color="danger">{t('common.remove')}</T>
            </Pressable>
          ) : null}
        </View>
        <T variant="title" center numberOfLines={1}>{shownName}</T>
        {motto.trim() ? (
          <T color="textSecondary" center style={styles.motto}>«{motto.trim()}»</T>
        ) : null}
        {instagram ? (
          <Pressable onPress={() => openLink(instagramUrl(instagram))} hitSlop={8}>
            <T variant="caption" color="accent">@{instagram}</T>
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.form}>
        <TextField
          label={t('contract.profile.name')}
          value={name}
          onChangeText={setName}
          onFocus={() => setEditing('name')}
          onBlur={() => commit('name', name.trim())}
          placeholder={t('contract.profile.namePlaceholder')}
          maxLength={40}
          textContentType="nickname"
          returnKeyType="done"
        />
        <TextField
          label={t('contract.profile.motto')}
          value={motto}
          onChangeText={setMotto}
          onFocus={() => setEditing('motto')}
          onBlur={() => commit('motto', motto.trim())}
          placeholder={t('contract.profile.mottoPlaceholder')}
          maxLength={80}
          hint={`${motto.length}/80`}
          returnKeyType="done"
        />
        <TextField
          label={t('contract.profile.instagram')}
          value={instagram ? `@${instagram}` : ''}
          onChangeText={(v) => setInstagram(cleanInstagram(v))}
          onFocus={() => setEditing('instagram')}
          onBlur={() => commit('instagram', instagram)}
          placeholder={t('contract.profile.instagramPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'ios' ? 'twitter' : 'default'}
          returnKeyType="done"
        />
      </Card>

      <SectionTitle>{t('contract.profile.stats')}</SectionTitle>
      <View style={styles.tiles}>
        <StatTile label={t('contract.profile.arcs')} value={`${stats.arcs}`} sub={t('contract.profile.started')} />
        <StatTile label={t('contract.profile.held')} value={`${stats.held}`} sub={t('contract.profile.heldDays', { count: stats.held })} />
      </View>
      <View style={styles.tiles}>
        <StatTile label={t('contract.profile.bestStreak')} value={`${stats.best}`} sub={t('contract.profile.inARow')} />
        <StatTile
          label={t('contract.profile.rate')}
          value={stats.active?.evaluatedDays ? `${Math.round(stats.active.completionRate * 100)}%` : '–'}
          sub={t('contract.profile.currentArc')}
        />
      </View>

      <Button title={stats.arcs > 1 ? t('contract.profile.allArcs', { count: stats.arcs }) : t('contract.profile.yourArcs')} variant="secondary" small onPress={() => router.push('/arcs')} />

      <SectionTitle
        action={
          <T variant="caption" color="textSecondary">
            {t('contract.profile.badgesCount', { count: badges.size, total: BADGES.length })}
          </T>
        }>
        {t('contract.profile.badges')}
      </SectionTitle>
      <Card>
        <BadgeGrid earned={badges} />
      </Card>

      {supabaseConfigured && (
        <>
          <SectionTitle>{t('contract.profile.account')}</SectionTitle>
          {session ? (
            <>
              <Pressable
                onPress={() => router.push('/konto')}
                style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
                <View style={[styles.dot, { backgroundColor: sync.state === 'error' ? theme.danger : theme.accent }]} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{t('contract.account.title')}</T>
                  <T variant="caption" numberOfLines={1}>
                    {sync.state === 'error' ? t('contract.profileRow.syncFailed') : session.user.email}
                  </T>
                </View>
                <ChevronIcon color={theme.textTertiary} size={16} />
              </Pressable>
              <BlockedList />
              <Button
                title={t('contract.account.signOut')}
                variant="secondary"
                onPress={async () => {
                  if (!(await confirm(t('contract.account.signOutTitle'), t('contract.account.signOutBody'), t('contract.account.signOut')))) return;
                  await logout();
                }}
              />
            </>
          ) : (
            <Card tone="surfaceMuted" bordered={false} style={styles.form}>
              <T variant="bodyStrong">{t('contract.profile.notSignedIn')}</T>
              <T variant="caption">
                {t('contract.profile.signInPitch')}
              </T>
              <Button title={t('contract.account.signIn')} onPress={() => router.push('/konto')} />
            </Card>
          )}
        </>
      )}

      <SettingsSections />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  imageActions: { flexDirection: 'row', gap: Spacing.four },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  motto: { fontStyle: 'italic', paddingHorizontal: Spacing.four },
  form: { gap: Spacing.four },
  tiles: { flexDirection: 'row', gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
