import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useBadges } from '@/hooks/use-badges';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { t } from '@/i18n';
import { BADGE_BY_ID, badgeKey, type EarnedBadge, freshBadges } from '@/lib/badges';
import { haptic } from '@/lib/haptics';
import { markBadgesSeen, useAppState } from '@/store/store';

import { BadgeMedal } from './badge';
import { Button } from './ui/button';
import { T } from './ui/text';

const CONFETTI_COLORS = ['#2657D9', '#7196F6', '#0E8A6A', '#E0A526', '#C2362B', '#FFFFFF'];

/**
 * Zeigt neu verdiente Abzeichen nacheinander als kleine Feier.
 * Beim ersten Start (oder auf einem neuen Gerät) werden alte Abzeichen still übernommen.
 */
export function BadgeCelebration() {
  const earned = useBadges();
  const today = useToday();
  const { settings } = useAppState();
  const seen = settings.seenBadges;

  // Erstes Mal: alles Bisherige als gesehen markieren, ausser frisch verdiente.
  useEffect(() => {
    if (seen !== null) return;
    const fresh = new Set(freshBadges(earned, [], today).map(badgeKey));
    markBadgesSeen(earned.map(badgeKey).filter((k) => !fresh.has(k)));
  }, [seen, earned, today]);

  const queue = useMemo(() => (seen === null ? [] : freshBadges(earned, seen, today)), [earned, seen, today]);

  // Ältere, nie gefeierte Abzeichen (z. B. nach dem Sync) still übernehmen.
  useEffect(() => {
    if (seen === null) return;
    const s = new Set(seen);
    const fresh = new Set(queue.map(badgeKey));
    const stale = earned.map(badgeKey).filter((k) => !s.has(k) && !fresh.has(k));
    if (stale.length) markBadgesSeen(stale);
  }, [earned, seen, queue]);

  const current = queue[0];
  return <CelebrationModal key={current ? badgeKey(current) : 'none'} badge={current} onDone={() => current && markBadgesSeen([badgeKey(current)])} />;
}

function CelebrationModal({ badge, onDone }: { badge: EarnedBadge | undefined; onDone: () => void }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.4)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(!!badge);

  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.35,
        rotate: Math.random() * 720 - 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
      })),
    [width],
  );

  useEffect(() => {
    if (!badge) return;
    haptic.success();
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [badge, scale, fall]);

  if (!badge) return null;
  const def = BADGE_BY_ID[badge.id];

  const close = () => {
    setVisible(false);
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(5,10,20,0.72)' }]}>
        {pieces.map((p, i) => {
          const progress = fall.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.piece,
                {
                  left: p.x,
                  width: p.w,
                  height: p.w * 1.6,
                  backgroundColor: p.color,
                  opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-40 - p.delay * 200, height * 0.9] }) },
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                    { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] }) },
                  ],
                },
              ]}
            />
          );
        })}
        <Animated.View style={[styles.card, { backgroundColor: theme.surface, transform: [{ scale }] }]}>
          <T variant="label" color="accent">{t('history.badges.new')}</T>
          <BadgeMedal badge={def} earned size={112} />
          <T variant="title" center>{def.title}</T>
          <T color="textSecondary" center>{def.description}</T>
          <Button title={t('history.badges.cheer')} onPress={close} style={styles.button} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  button: { alignSelf: 'stretch', marginTop: Spacing.two },
  piece: { position: 'absolute', top: 0, borderRadius: 2 },
});
