import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { MyAvatar, RemoteAvatar } from '@/components/avatar';
import { ChallengeCard } from '@/components/challenge-card';
import { CrewFeed, type FeedPerson } from '@/components/crew-feed';
import { ChevronIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { confirm } from '@/lib/confirm';
import { buildFeed, challengeProgress, inviteMessage, rankMembers, REACTION_EMOJIS, type Reaction, type ReactionEmoji, type StatusRow } from '@/lib/crew';
import { weekStart } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { addReaction, cachedCrew, type CrewDetail, leaveCrew, loadCrew, removeReaction, subscribeCrew } from '@/services/crews';
import { useSession } from '@/services/supabase';

export default function CrewScreen() {
  const theme = useTheme();
  const today = useToday();
  const session = useSession();
  const me = session?.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<CrewDetail | null>(() => (id ? (cachedCrew(id) ?? null) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setDetail(await loadCrew(id, today));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live-Updates: neu laden, wenn jemand reagiert oder seinen Tag abhakt.
  const memberIds = useRef(new Set<string>());
  useEffect(() => {
    memberIds.current = new Set(detail?.members.map((m) => m.user_id) ?? []);
  }, [detail]);
  useEffect(() => {
    if (!id) return;
    return subscribeCrew(id, (uid) => memberIds.current.has(uid), load);
  }, [id, load]);

  const ranked = useMemo(() => (detail ? rankMembers(detail.members, detail.rows, today) : []), [detail, today]);

  const people = useMemo(() => {
    const out: Record<string, FeedPerson> = {};
    for (const m of detail?.members ?? []) {
      const p = detail?.profiles[m.user_id];
      out[m.user_id] = { name: p?.name || m.display_name, avatarPath: p?.avatar_path };
    }
    return out;
  }, [detail]);
  const names = useMemo(() => Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.name])), [people]);

  const challenge = detail?.challenges.find((c) => c.week === weekStart(today));
  const progress = useMemo(
    () => (detail && challenge ? challengeProgress(challenge, detail.members, detail.rows, today) : null),
    [detail, challenge, today],
  );
  const feed = useMemo(
    () =>
      detail
        ? buildFeed(
            {
              members: detail.members,
              rows: detail.rows,
              reactions: detail.reactions,
              badges: Object.fromEntries(Object.entries(detail.profiles).map(([k, p]) => [k, p.badges])),
              challenges: detail.challenges,
            },
            today,
          )
        : [],
    [detail, today],
  );
  const canEditChallenge = !!challenge && !!me && (challenge.created_by === me || detail?.crew.created_by === me);
  const openChallenge = () => detail && router.push({ pathname: '/crew/challenge', params: { crew: detail.crew.id } });

  const toggleReaction = async (toUser: string, emoji: ReactionEmoji) => {
    if (!detail || !me) return;
    const existing = detail.reactions.find((r) => r.from_user === me && r.to_user === toUser && r.date === today && r.emoji === emoji);
    haptic.light();
    if (existing) {
      setDetail({ ...detail, reactions: detail.reactions.filter((r) => r.id !== existing.id) });
      await removeReaction(existing.id).catch(load);
    } else {
      const temp: Reaction = { id: `tmp-${Date.now()}`, crew_id: detail.crew.id, from_user: me, to_user: toUser, date: today, emoji };
      setDetail({ ...detail, reactions: [...detail.reactions, temp] });
      try {
        const saved = await addReaction(detail.crew.id, toUser, today, emoji);
        setDetail((d) => (d ? { ...d, reactions: d.reactions.map((r) => (r.id === temp.id ? saved : r)) } : d));
      } catch {
        load();
      }
    }
  };

  const invite = async () => {
    if (!detail) return;
    try {
      await Share.share({ message: inviteMessage(detail.crew) });
    } catch {
      // Teilen abgebrochen
    }
  };

  const leave = async () => {
    if (!detail) return;
    if (!(await confirm('Crew verlassen?', `Du verlässt «${detail.crew.name}». Mit dem Code kannst du jederzeit wieder beitreten.`, 'Verlassen', true))) return;
    try {
      await leaveCrew(detail.crew.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const heldCount = ranked.filter((m) => m.heldToday).length;
  const activeCount = ranked.filter((m) => !m.inactive).length;

  return (
    <Screen refreshing={loading && !!detail} onRefresh={load}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Zurück" style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
          <ChevronIcon dir="left" color={theme.text} />
        </Pressable>
        <View style={styles.flex}>
          <T variant="label">Crew</T>
          <T variant="title" numberOfLines={1}>
            {detail?.crew.name ?? ' '}
          </T>
        </View>
      </View>

      {error ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" color="danger">
            {error}
          </T>
        </Card>
      ) : null}

      {detail && (
        <>
          <Card style={styles.summary}>
            <T variant="label" color="accent">Heute</T>
            <T variant="title">
              {heldCount} von {activeCount} haben gehalten
            </T>
            <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.barFill, { backgroundColor: theme.accent, width: `${activeCount ? (heldCount / activeCount) * 100 : 0}%` }]} />
            </View>
          </Card>

          {challenge && progress ? (
            <ChallengeCard challenge={challenge} progress={progress} names={names} onPress={canEditChallenge ? openChallenge : undefined} />
          ) : (
            <Button title="Wochen-Challenge starten" variant="secondary" onPress={openChallenge} />
          )}

          <SectionTitle>Rangliste</SectionTitle>
          <View style={styles.list}>
            {ranked.map((m) => (
              <MemberRow
                key={m.member.user_id}
                rank={m.rank}
                userId={m.member.user_id}
                name={detail.profiles[m.member.user_id]?.name || m.member.display_name}
                avatarPath={detail.profiles[m.member.user_id]?.avatar_path}
                onOpen={() => router.push({ pathname: '/crew/mitglied', params: { crew: detail.crew.id, user: m.member.user_id } })}
                isMe={m.member.user_id === me}
                latest={m.latest}
                week={m.week}
                inactive={m.inactive}
                reactions={detail.reactions.filter((r) => r.to_user === m.member.user_id && r.date === today)}
                me={me}
                onReact={(emoji) => toggleReaction(m.member.user_id, emoji)}
              />
            ))}
          </View>

          <SectionTitle>Was läuft</SectionTitle>
          <CrewFeed items={feed.slice(0, 15)} people={people} me={me} today={today} />

          <Card tone="accentSoft" bordered={false} style={styles.invite}>
            <View style={styles.flex}>
              <T variant="label" color="accent">Einladungscode</T>
              <T style={[styles.code, { color: theme.text }]}>{detail.crew.invite_code}</T>
            </View>
            <Button title="Einladen" small onPress={invite} />
          </Card>

          <Button title="Crew verlassen" variant="ghost" small onPress={leave} />
        </>
      )}
    </Screen>
  );
}

const STATUS_DOT: Record<string, 'accent' | 'partial' | 'shield' | 'missed' | 'surfaceMuted'> = {
  done: 'accent',
  partial: 'partial',
  shielded: 'shield',
  missed: 'missed',
};

function MemberRow({
  rank,
  userId,
  name,
  avatarPath,
  onOpen,
  isMe,
  latest,
  week,
  inactive,
  reactions,
  me,
  onReact,
}: {
  rank: number;
  userId: string;
  name: string;
  avatarPath: string | null | undefined;
  onOpen: () => void;
  isMe: boolean;
  latest: StatusRow | null;
  week: (StatusRow['status'] | undefined)[];
  inactive: boolean;
  reactions: Reaction[];
  me: string | undefined;
  onReact: (emoji: ReactionEmoji) => void;
}) {
  const theme = useTheme();
  const today = week[6];
  const counts = REACTION_EMOJIS.map((e) => ({
    emoji: e,
    count: reactions.filter((r) => r.emoji === e).length,
    mine: reactions.some((r) => r.emoji === e && r.from_user === me),
  }));

  let sub = 'Noch keine Daten';
  if (latest) {
    sub = `Tag ${latest.day_number} · 🔥 ${latest.streak} · ${latest.rate} %`;
    if (inactive) sub = `Zuletzt aktiv an Tag ${latest.day_number}`;
  }

  const badge =
    today === 'done' ? (
      <View style={[styles.badge, { backgroundColor: theme.accent }]}>
        <T variant="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>✓</T>
      </View>
    ) : latest && today ? (
      <View style={[styles.badge, { backgroundColor: theme.surfaceMuted }]}>
        <T variant="caption" style={styles.badgeText}>
          {latestDone(latest, today)}
        </T>
      </View>
    ) : (
      <View style={[styles.badge, { backgroundColor: theme.surfaceMuted }]}>
        <T variant="caption" color="textTertiary">–</T>
      </View>
    );

  return (
    <View style={[styles.member, { backgroundColor: theme.surface, borderColor: isMe ? theme.accent : theme.border, opacity: inactive ? 0.6 : 1 }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Profil von ${name}`}
        style={({ pressed }) => [styles.memberTop, { opacity: pressed ? 0.7 : 1 }]}>
        <T variant="bodyStrong" color="textTertiary" style={styles.rank}>
          {inactive ? '' : rank}
        </T>
        {isMe ? <MyAvatar /> : <RemoteAvatar id={userId} name={name} path={avatarPath} />}
        <View style={styles.flex}>
          <T variant="bodyStrong" numberOfLines={1}>
            {name}
            {isMe ? <T variant="caption" color="accent">  du</T> : null}
          </T>
          <T variant="caption" numberOfLines={1}>
            {sub}
          </T>
        </View>
        {badge}
      </Pressable>

      <View style={styles.dots}>
        {week.map((s, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: s ? theme[STATUS_DOT[s] ?? 'surfaceMuted'] : theme.surfaceMuted },
              s === 'open' && { borderWidth: 1.5, borderColor: theme.accent, backgroundColor: 'transparent' },
            ]}
          />
        ))}
      </View>

      {inactive ? null : isMe ? (
        counts.some((c) => c.count) ? (
          <T variant="caption">
            Heute bekommen:{' '}
            {counts
              .filter((c) => c.count)
              .map((c) => `${c.emoji} ${c.count}`)
              .join('  ')}
          </T>
        ) : null
      ) : (
        <View style={styles.reactions}>
          {counts.map((c) => (
            <Pressable
              key={c.emoji}
              onPress={() => onReact(c.emoji)}
              accessibilityLabel={`${c.emoji} an ${name}`}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: c.mine ? theme.accentSoft : theme.surfaceMuted,
                  borderColor: c.mine ? theme.accent : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <T style={styles.pillEmoji}>{c.emoji}</T>
              {c.count ? (
                <T variant="caption" color={c.mine ? 'accent' : 'textSecondary'} style={styles.pillCount}>
                  {c.count}
                </T>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function latestDone(latest: StatusRow, today: StatusRow['status']) {
  if (today === 'shielded') return '🛡';
  if (today === 'missed') return '✗';
  return `${latest.done}/${latest.total}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  summary: { gap: 6 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 8, borderRadius: 4 },
  list: { gap: Spacing.two },
  member: { borderRadius: Radius.lg, borderWidth: 1.5, padding: Spacing.three, paddingRight: Spacing.four, gap: Spacing.three },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rank: { width: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },
  badge: { minWidth: 36, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 6, marginLeft: 20 + Spacing.three },
  dot: { width: 14, height: 14, borderRadius: 4 },
  reactions: { flexDirection: 'row', gap: 6, marginLeft: 20 + Spacing.three, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1.5 },
  pillEmoji: { fontSize: 16, lineHeight: 20 },
  pillCount: { fontWeight: '700' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  code: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: 4, fontVariant: ['tabular-nums'] },
});
