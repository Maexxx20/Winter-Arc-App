import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BADGE_BY_ID, type BadgeId } from '@/lib/badges';
import { challengeTitle, type FeedItem } from '@/lib/crew';
import { diffDays, formatShort, type ISODate } from '@/lib/date';

import { RemoteAvatar } from './avatar';
import { T } from './ui/text';

export interface FeedPerson {
  name: string;
  avatarPath: string | null | undefined;
}

function when(date: ISODate, today: ISODate): string {
  const d = diffDays(date, today);
  if (d === 0) return 'heute';
  if (d === 1) return 'gestern';
  return formatShort(date);
}

/** «Was läuft»: Abzeichen, Beitritte, Reaktionen und gemeinsame Erfolge der letzten 7 Tage. */
export function CrewFeed({ items, people, me, today }: { items: FeedItem[]; people: Record<string, FeedPerson>; me?: string; today: ISODate }) {
  const theme = useTheme();
  const name = (id: string) => (id === me ? 'Du' : (people[id]?.name ?? 'Jemand'));
  const obj = (id: string) => (id === me ? 'dir' : (people[id]?.name ?? 'jemandem'));

  if (!items.length) {
    return (
      <T variant="caption" color="textTertiary">
        Noch nichts los. Abzeichen, neue Mitglieder und Reaktionen erscheinen hier.
      </T>
    );
  }

  return (
    <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      {items.map((it, i) => {
        let icon: React.ReactNode;
        let text: string;
        switch (it.kind) {
          case 'badge': {
            const b = BADGE_BY_ID[it.badgeId as BadgeId];
            icon = <Emoji>{b?.icon ?? '🏅'}</Emoji>;
            text = `${name(it.userId)} ${it.userId === me ? 'hast' : 'hat'} «${b?.title ?? it.badgeId}» erreicht`;
            break;
          }
          case 'joined':
            icon = <RemoteAvatar id={it.userId} name={people[it.userId]?.name ?? '?'} path={people[it.userId]?.avatarPath} size={32} />;
            text = `${name(it.userId)} ${it.userId === me ? 'bist' : 'ist'} der Crew beigetreten`;
            break;
          case 'reactions':
            icon = <Emoji>{it.emojis[0]}</Emoji>;
            text = `${name(it.from)} ${it.from === me ? 'hast' : 'hat'} ${obj(it.to)} ${it.emojis.join(' ')} geschickt`;
            break;
          case 'crew_day':
            icon = <Emoji>🤝</Emoji>;
            text = it.run > 1 ? `Die ganze Crew hat gehalten – ${it.run} Tage in Folge` : 'Die ganze Crew hat gehalten';
            break;
          case 'challenge_done':
            icon = <Emoji>🎉</Emoji>;
            text = `Challenge geschafft: ${challengeTitle(it.challenge)}`;
            break;
        }
        return (
          <View key={i} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
            <View style={styles.icon}>{icon}</View>
            <T variant="caption" color="text" style={styles.flex}>{text}</T>
            <T variant="caption" color="textTertiary">{when(it.date, today)}</T>
          </View>
        );
      })}
    </View>
  );
}

function Emoji({ children }: { children: string }) {
  return <T style={styles.emoji}>{children}</T>;
}

const styles = StyleSheet.create({
  list: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  icon: { width: 32, alignItems: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  flex: { flex: 1 },
});
