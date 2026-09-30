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
import { cachedCrew, type CrewDetail, loadCrew } from '@/services/crews';
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

  const name = profile?.name || entry?.member.display_name || '';
  const latest = entry?.latest ?? null;
  const received = detail?.reactions.filter((r) => r.to_user === user) ?? [];
  const earnedIds = new Set((profile?.badges ?? []).map((b) => b.id));
  const badgeList = BADGES.filter((b) => earnedIds.has(b.id));

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">{detail?.crew.name ?? 'Crew'}</T>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Schliessen"
          style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {error && !detail ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" color="danger">{error}</T>
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
                <T variant="caption" color="accent">@{profile.instagram} auf Instagram</T>
              </Pressable>
            ) : null}
            <T variant="caption" color="textTertiary">
              {entry.member.role === 'owner' ? 'Gründer:in' : 'Mitglied'} seit {formatShort(toISO(new Date(entry.member.joined_at)), true)}
            </T>
          </View>

          {latest ? (
            <>
              <View style={styles.tiles}>
                <StatTile
                  label="Streak"
                  value={`${latest.streak}`}
                  sub={`Rekord ${latest.best_streak}`}
                  icon={<FlameIcon color={latest.streak > 0 ? theme.accent : theme.textTertiary} size={16} />}
                />
                <StatTile label="Quote" value={`${latest.rate}%`} sub="gehalten" />
              </View>
              <View style={styles.tiles}>
                <StatTile label="Arc" value={`${latest.day_number}`} sub={`von ${latest.total_days} Tagen`} />
                <StatTile label="Letzte 7 Tage" value={`${entry.week.filter((st) => st === 'done').length}/7`} sub="gehalten" />
              </View>
            </>
          ) : (
            <Card tone="surfaceMuted" bordered={false}>
              <T variant="caption">Noch keine Daten – der Arc hat noch nicht begonnen oder wurde noch nicht abgeglichen.</T>
            </Card>
          )}

          {badgeList.length ? (
            <Card style={styles.reactions}>
              <T variant="label">Abzeichen · {badgeList.length}</T>
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
              <T variant="label">Reaktionen der letzten 7 Tage</T>
              <T style={styles.emojis}>{received.map((r) => r.emoji).join(' ')}</T>
            </Card>
          ) : null}

          {isMe ? (
            <Button title="Profil bearbeiten" variant="secondary" onPress={() => router.push('/profil')} />
          ) : (
            <Button
              title="Profil melden"
              variant="ghost"
              small
              onPress={() => {
                const subject = encodeURIComponent('Nordwand: Profil melden');
                const body = encodeURIComponent(
                  `Crew: ${detail?.crew.name ?? ''}\nPerson: ${name}\nID: ${user}\n\nWas ist das Problem?\n`,
                );
                Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => undefined);
              }}
            />
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
});
