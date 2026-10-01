import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
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
  if (d === 0) return t('crew.feed.today');
  if (d === 1) return t('crew.feed.yesterday');
  return formatShort(date);
}

/** «Was läuft»: Abzeichen, Beitritte, Reaktionen und gemeinsame Erfolge der letzten 7 Tage. */
export function CrewFeed({ items, people, me, today }: { items: FeedItem[]; people: Record<string, FeedPerson>; me?: string; today: ISODate }) {
  const theme = useTheme();
  const name = (id: string) => people[id]?.name ?? t('common.someone');
  const obj = (id: string) => people[id]?.name ?? t('crew.feed.someoneTo');

  if (!items.length) {
    return (
      <T variant="caption" color="textTertiary">
        {t('crew.feed.empty')}
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
            const badge = b?.title ?? it.badgeId;
            text = it.userId === me ? t('crew.feed.badgeMe', { badge }) : t('crew.feed.badge', { name: name(it.userId), badge });
            break;
          }
          case 'joined':
            icon = <RemoteAvatar id={it.userId} name={people[it.userId]?.name ?? '?'} path={people[it.userId]?.avatarPath} size={32} />;
            text = it.userId === me ? t('crew.feed.joinedMe') : t('crew.feed.joined', { name: name(it.userId) });
            break;
          case 'reactions':
            icon = <Emoji>{it.emojis[0]}</Emoji>;
            {
              const emojis = it.emojis.join(' ');
              text =
                it.from === me
                  ? t('crew.feed.reactionFromMe', { to: obj(it.to), emojis })
                  : it.to === me
                    ? t('crew.feed.reactionToMe', { from: name(it.from), emojis })
                    : t('crew.feed.reaction', { from: name(it.from), to: obj(it.to), emojis });
            }
            break;
          case 'crew_day':
            icon = <Emoji>🤝</Emoji>;
            text = it.run > 1 ? t('crew.feed.crewDayRun', { count: it.run }) : t('crew.feed.crewDay');
            break;
          case 'challenge_done':
            icon = <Emoji>🎉</Emoji>;
            text = t('crew.feed.challengeDone', { title: challengeTitle(it.challenge) });
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
