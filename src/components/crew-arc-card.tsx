import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import type { CrewArc, CrewArcSignature } from '@/lib/crew-arc';
import { diffDays, formatShort, type ISODate } from '@/lib/date';

import { RemoteAvatar } from './avatar';
import { Card } from './ui/card';
import { T } from './ui/text';

export interface ArcPerson {
  name: string;
  avatarPath: string | null | undefined;
}

/** Crew-Arc in der Crew-Ansicht: Zeitraum, Regeln, wer unterschrieben hat. */
export function CrewArcCard({
  arc,
  signatures,
  people,
  me,
  today,
  onPress,
}: {
  arc: CrewArc;
  signatures: CrewArcSignature[];
  people: Record<string, ArcPerson>;
  me: string | undefined;
  today: ISODate;
  onPress: () => void;
}) {
  const theme = useTheme();
  const signed = signatures.filter((s) => s.crew_arc_id === arc.id && people[s.user_id]);
  const mine = !!me && signed.some((s) => s.user_id === me);
  const total = diffDays(arc.start_date, arc.end_date) + 1;
  const status =
    today < arc.start_date
      ? t('crewx.arc.startsOn', { date: formatShort(arc.start_date) })
      : today > arc.end_date
        ? t('crewx.arc.ended')
        : t('crewx.arc.running', { day: diffDays(arc.start_date, today) + 1, total });

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <Card tone={mine ? 'accentSoft' : 'surface'} style={[styles.card, { opacity: pressed ? 0.85 : 1 }]}>
          <View style={styles.row}>
            <T variant="label" color="accent" style={styles.flex}>
              {t('crewx.arc.label')}
            </T>
            <T variant="caption" color="textSecondary">
              {status}
            </T>
          </View>
          <T variant="heading">{arc.title}</T>
          <T variant="caption">
            {formatShort(arc.start_date)} – {formatShort(arc.end_date, true)} · {t('crewx.arc.rules', { count: arc.rules.length })}
          </T>
          <T style={styles.icons}>{arc.rules.map((r) => r.icon).join('  ')}</T>
          <View style={styles.row}>
            <View style={styles.avatars}>
              {signed.slice(0, 6).map((s, i) => (
                <View key={s.user_id} style={[styles.avatarWrap, { marginLeft: i ? -8 : 0, borderColor: theme.surface }]}>
                  <RemoteAvatar id={s.user_id} name={people[s.user_id]?.name ?? '?'} path={people[s.user_id]?.avatarPath} size={26} />
                </View>
              ))}
            </View>
            <T variant="caption" style={styles.flex}>
              {t('crewx.arc.signed', { count: signed.length })}
            </T>
            <T variant="bodyStrong" color="accent">
              {mine ? `✓ ${t('crewx.arc.youAreIn')}` : t('crewx.arc.signNow')}
            </T>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  icons: { fontSize: 20, lineHeight: 26 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderWidth: 2, borderRadius: 15 },
});
