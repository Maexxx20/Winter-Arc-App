import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { MinusIcon, PlusIcon } from '../icons';
import { T } from './text';

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[styles.segment, active && { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <T variant="bodyStrong" color={active ? 'text' : 'textSecondary'} style={styles.segmentText}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}>
      {icon ? <T style={styles.chipIcon}>{icon}</T> : null}
      <T variant="caption" color={selected ? 'accent' : 'text'} style={styles.chipLabel}>
        {label}
      </T>
    </Pressable>
  );
}

export function TextField({ label, hint, style, ...rest }: TextInputProps & { label?: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? <T variant="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={theme.textTertiary}
        style={[
          styles.input,
          { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontFamily: Fonts?.sans },
          rest.multiline && styles.multiline,
          style,
        ]}
        {...rest}
      />
      {hint ? <T variant="caption" color="textTertiary">{hint}</T> : null}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 7,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const theme = useTheme();
  const btn = (dir: 1 | -1, icon: ReactNode, disabled: boolean) => (
    <Pressable
      onPress={() => {
        haptic.tap();
        onChange(Math.min(max, Math.max(min, value + dir)));
      }}
      disabled={disabled}
      hitSlop={6}
      style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted, opacity: disabled ? 0.35 : 1 }]}>
      {icon}
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn(-1, <MinusIcon color={theme.text} size={16} />, value <= min)}
      <T variant="bodyStrong" style={styles.stepValue}>
        {format ? format(value) : value}
      </T>
      {btn(1, <PlusIcon color={theme.text} size={16} />, value >= max)}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T variant="label">{children}</T>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md - 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  chipIcon: { fontSize: 15, lineHeight: 20 },
  chipLabel: { fontWeight: '600', fontSize: 14 },
  field: { gap: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 72, textAlign: 'center' },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
