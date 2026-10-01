import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { type Challenge, type ChallengeProgress, challengeTitle } from '@/lib/crew';

import { Card } from './ui/card';
import { T } from './ui/text';

/** Wochen-Challenge der Crew mit Fortschritt. */
export function ChallengeCard({
  challenge,
  progress,
  names,
  onPress,
}: {
  challenge: Challenge;
  progress: ChallengeProgress;
  names: Record<string, string>;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const ratio = progress.goal ? Math.min(1, progress.value / progress.goal) : 0;
  const progressText = t(challenge.kind === 'crew_total' ? 'crew.challenge.progressDays' : 'crew.challenge.progressPeople', {
    value: progress.value,
    count: progress.goal,
  });
  const status = progress.done
    ? t('crew.challenge.done')
    : progress.daysLeft === 0
      ? t('crew.challenge.missed')
      : progress.daysLeft === 1
        ? t('crew.challenge.lastDay')
        : t('crew.challenge.daysLeft', { count: progress.daysLeft });

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {({ pressed }) => (
        <Card tone={progress.done ? 'accentSoft' : 'surface'} style={[styles.card, { opacity: pressed ? 0.85 : 1 }]}>
          <View style={styles.row}>
            <T variant="label" color="accent" style={styles.flex}>{t('crew.challenge.label')}</T>
            <T variant="caption" color={progress.done ? 'accent' : 'textSecondary'}>{status}</T>
          </View>
          <T variant="heading">{progress.done ? '🎉 ' : ''}{challengeTitle(challenge)}</T>
          <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: theme.accent }]} />
          </View>
          <T variant="caption">{progressText}</T>
          {progress.perMember.length > 1 ? (
            <T variant="caption" color="textTertiary" numberOfLines={2}>
              {progress.perMember.map((p) => `${names[p.userId] ?? '?'} ${p.days}`).join(' · ')}
            </T>
          ) : null}
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  bar: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  fill: { height: 10, borderRadius: 5 },
});
