import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { formatTime } from '@/lib/reminders';
import type { TimeOfDay } from '@/lib/types';

import { MinusIcon, PlusIcon } from '../icons';
import { T } from './text';

const STEP = 15;

/** Zeile mit Schalter und Uhrzeit (in 15-Minuten-Schritten). */
export function TimeRow({
  label,
  hint,
  value,
  fallback,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: TimeOfDay | null;
  fallback: TimeOfDay;
  onChange: (v: TimeOfDay | null) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const on = value !== null;
  const bump = (dir: 1 | -1) => {
    if (value === null) return;
    haptic.tap();
    onChange((value + dir * STEP + 24 * 60) % (24 * 60));
  };

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <T variant="bodyStrong">{label}</T>
          {hint ? <T variant="caption">{hint}</T> : null}
        </View>
        <Switch
          disabled={disabled}
          value={on}
          onValueChange={(v) => onChange(v ? fallback : null)}
          trackColor={{ true: theme.accent, false: theme.border }}
        />
      </View>
      {on && (
        <View style={styles.stepper}>
          <Pressable disabled={disabled} onPress={() => bump(-1)} hitSlop={6} accessibilityLabel="Früher" style={[styles.btn, { backgroundColor: theme.surfaceMuted }]}>
            <MinusIcon color={theme.text} size={16} />
          </Pressable>
          <T variant="number" style={styles.time}>
            {formatTime(value!)}
          </T>
          <Pressable disabled={disabled} onPress={() => bump(1)} hitSlop={6} accessibilityLabel="Später" style={[styles.btn, { backgroundColor: theme.surfaceMuted }]}>
            <PlusIcon color={theme.text} size={16} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.three },
  disabled: { opacity: 0.45 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, alignSelf: 'flex-start' },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  time: { minWidth: 72, textAlign: 'center' },
});
