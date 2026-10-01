import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { t } from '@/i18n';

import { T } from './ui/text';

type Props = {
  onSigned: () => void;
  disabled?: boolean;
  duration?: number;
};

/** Gedrückt halten zum Unterschreiben – ein kleines Ritual statt eines Klicks. */
export function HoldToSign({ onSigned, disabled, duration = 1400 }: Props) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const start = () => {
    if (disabled || done) return;
    setHolding(true);
    haptic.medium();
    anim.current = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (finished) {
        setDone(true);
        haptic.success();
        onSigned();
      }
    });
  };

  const cancel = () => {
    setHolding(false);
    if (done) return;
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('today.sign.a11y')}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        setDone(true);
        onSigned();
      }}
      style={[styles.base, { backgroundColor: theme.text, opacity: disabled ? 0.35 : 1 }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: theme.accent }]} />
      <View style={styles.label}>
        <T variant="bodyStrong" center numberOfLines={1} style={{ color: theme.background }}>
          {done ? t('today.sign.done') : holding ? t('today.sign.holding') : t('today.sign.idle')}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 58, borderRadius: Radius.md, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  label: { alignItems: 'center', paddingHorizontal: Spacing.four },
});
