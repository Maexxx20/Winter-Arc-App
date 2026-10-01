import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { MyAvatar, RemoteAvatar } from '@/components/avatar';
import { BadgeMedal } from '@/components/badge';
import { CloseIcon, FlameIcon } from '@/components/icons';
import { StatTile } from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { openLink, SUPPORT_EMAIL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { BADGES } from '@/lib/badges';
import { rankMembers } from '@/lib/crew';
import { formatShort, toISO } from '@/lib/date';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { blockUser, loadBlocks, unblockUser, useBlocks } from '@/services/blocks';
import { cachedCrew, type CrewDetail, loadCrew, removeMember } from '@/services/crews';
import { instagramUrl } from '@/lib/profile';
import { useSession } from '@/services/supabase';

/** Profil eines Crew-Mitglieds: Bild, Motto, Instagram und die geteilte Tages-Zusammenfassung. */
export default function MemberScreen() {
  const theme = useTheme();
  const today = useToday();
  const session = useSession();
  const { crew, user } = useLocalSearchParams<{ crew: string; user: string }>();
  const [detail, setDetail] = useState<CrewDetail | null>(() => (crew ? (cachedCrew(crew) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blocks = useBlocks();

  useEffect(() => {
    loadBlocks().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!crew) return;
    loadCrew(crew, today)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [crew, today]);

  const ranked = useMemo(() => (detail ? rankMembers(detail.members, detail.rows, today) : []), [detail, today]);
  const entry = ranked.find((m) => m.member.user_id === user);
  const profile = user ? detail?.profiles[user] : undefined;
  const isMe = !!user && user === session?.user.id;
  const blocked = !!user && blocks.some((b) => b.blocked === user);
  const iAmOwner = !!detail && !!session && detail.crew.created_by === session.user.id;

  const name = profile?.name || entry?.member.display_name || '';
  const latest = entry?.latest ?? null;
  const received = detail?.reactions.filter((r) => r.to_user === user) ?? [];
  const earnedIds = new Set((profile?.badges ?? []).map((b) => b.id));
  const badgeList = BADGES.filter((b) => earnedIds.has(b.id));

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">{detail?.crew.name ?? t('crew.title')}</T>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
          style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {error ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" color="danger">{error}</T>
        </Card>
      ) : null}

      {entry && blocked ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption">{t('crewx.mod.blockedHint')}</T>
        </Card>
      ) : null}

      {entry && (
        <>
          <View style={styles.hero}>
            {isMe ? <MyAvatar size={112} /> : <RemoteAvatar id={user!} name={name} path={profile?.avatar_path} size={112} />}
            <T variant="title" center numberOfLines={2}>
              {name}
            </T>
            {profile?.motto ? (
              <T color="textSecondary" center style={styles.motto}>
                «{profile.motto}»
              </T>
            ) : null}
            {profile?.instagram ? (
              <Pressable onPress={() => openLink(instagramUrl(profile.instagram))} hitSlop={8} accessibilityRole="link">
                <T variant="caption" color="accent">{t('crew.member.instagram', { handle: profile.instagram })}</T>
              </Pressable>
            ) : null}
            <T variant="caption" color="textTertiary">
              {t(entry.member.role === 'owner' ? 'crew.member.ownerSince' : 'crew.member.memberSince', {
                date: formatShort(toISO(new Date(entry.member.joined_at)), true),
              })}
            </T>
          </View>

          {latest ? (
            <>
              <View style={styles.tiles}>
                <StatTile
                  label={t('crew.member.streak')}
                  value={`${latest.streak}`}
                  sub={t('crew.member.record', { count: latest.best_streak })}
                  icon={<FlameIcon color={latest.streak > 0 ? theme.accent : theme.textTertiary} size={16} />}
                />
                <StatTile label={t('crew.member.rate')} value={`${latest.rate}%`} sub={t('crew.member.held')} />
              </View>
              <View style={styles.tiles}>
                <StatTile label={t('crew.member.arc')} value={`${latest.day_number}`} sub={t('crew.member.ofDays', { total: latest.total_days })} />
                <StatTile label={t('crew.member.last7')} value={`${entry.week.filter((st) => st === 'done').length}/7`} sub={t('crew.member.held')} />
              </View>
            </>
          ) : (
            <Card tone="surfaceMuted" bordered={false}>
              <T variant="caption">{t('crew.member.noData')}</T>
            </Card>
          )}

          {badgeList.length ? (
            <Card style={styles.reactions}>
              <T variant="label">{t('crew.member.badges', { count: badgeList.length })}</T>
              <View style={styles.badges}>
                {badgeList.map((b) => (
                  <View key={b.id} style={styles.badge} accessible accessibilityLabel={b.title}>
                    <BadgeMedal badge={b} earned size={44} />
                    <T variant="caption" center numberOfLines={1} style={styles.badgeTitle}>{b.title}</T>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {received.length ? (
            <Card style={styles.reactions}>
              <T variant="label">{t('crew.member.reactions')}</T>
              <T style={styles.emojis}>{received.map((r) => r.emoji).join(' ')}</T>
            </Card>
          ) : null}

          {isMe ? (
            <Button title={t('crew.member.editProfile')} variant="secondary" onPress={() => router.push('/profil')} />
          ) : (
            <View style={styles.actions}>
              <Button
                title={blocked ? t('crewx.mod.unblock') : t('crewx.mod.block')}
                variant="secondary"
                small
                disabled={busy}
                onPress={async () => {
                  if (!user) return;
                  if (!blocked && !(await confirm(t('crewx.mod.blockTitle', { name }), t('crewx.mod.blockText', { name }), t('crewx.mod.block'), true))) return;
                  setBusy(true);
                  try {
                    if (blocked) await unblockUser(user);
                    else await blockUser(user, name);
                    if (crew) setDetail(await loadCrew(crew, today));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {iAmOwner ? (
                <Button
                  title={t('crewx.mod.remove')}
                  variant="danger"
                  small
                  disabled={busy}
                  onPress={async () => {
                    if (!user || !detail) return;
                    const ok = await confirm(
                      t('crewx.mod.removeTitle', { name }),
                      t('crewx.mod.removeText', { name, crew: detail.crew.name }),
                      t('common.remove'),
                      true,
                    );
                    if (!ok) return;
                    setBusy(true);
                    try {
                      await removeMember(detail.crew.id, user);
                      router.back();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ) : null}
              <Button
                title={t('crewx.mod.report')}
                variant="ghost"
                small
                onPress={() => {
                  const subject = encodeURIComponent(t('crew.member.reportSubject'));
                  const body = encodeURIComponent(t('crew.member.reportBody', { crew: detail?.crew.name ?? '', name, id: user ?? '' }));
                  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => undefined);
                }}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  motto: { fontStyle: 'italic', paddingHorizontal: Spacing.four },
  tiles: { flexDirection: 'row', gap: Spacing.three },
  reactions: { gap: Spacing.two },
  emojis: { fontSize: 22, lineHeight: 30 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  badge: { width: '25%', alignItems: 'center', gap: 4 },
  badgeTitle: { fontSize: 11, lineHeight: 14 },
  actions: { gap: Spacing.two },
});
