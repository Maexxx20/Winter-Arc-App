import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValueDone } from '@/lib/arc';
import { HEALTH_METRIC_BY_ID } from '@/lib/health';
import { haptic } from '@/lib/haptics';
import { describeRule, formatNumber } from '@/lib/templates';
import type { Rule } from '@/lib/types';
import { t } from '@/i18n';

import { CheckIcon, MinusIcon, PlusIcon } from './icons';
import { T } from './ui/text';

type Props = {
  rule: Rule;
  value: number;
  onChange: (value: number) => void;
  /** Wöchentliche Regeln: bisherige Treffer diese Woche (inkl. heute). */
  weekCount?: number;
  readOnly?: boolean;
};

export function stepFor(target: number): number {
  if (target <= 3) return 0.25;
  if (target <= 30) return 1;
  if (target <= 150) return 5;
  return 10;
}

export function RuleRow({ rule, value, onChange, weekCount, readOnly }: Props) {
  const theme = useTheme();
  const done = isValueDone(rule, value);
  const isAmount = rule.measure.kind === 'amount';
  const target = rule.measure.kind === 'amount' ? rule.measure.target : 1;
  const step = stepFor(target);

  const toggle = () => {
    if (readOnly) return;
    if (done) {
      haptic.light();
      onChange(0);
    } else {
      haptic.success();
      onChange(target);
    }
  };

  const bump = (dir: 1 | -1) => {
    if (readOnly) return;
    const next = Math.max(0, Math.round((value + dir * step) * 100) / 100);
    if (!isValueDone(rule, value) && isValueDone(rule, next)) haptic.success();
    else haptic.tap();
    onChange(next);
  };

  let subtitle = describeRule(rule);
  const auto = rule.health ? ` · ${HEALTH_METRIC_BY_ID[rule.health.metric].icon} auto` : '';
  if (rule.frequency.kind === 'weekly' && weekCount !== undefined) {
    subtitle = t('today.row.thisWeek', { done: weekCount, times: rule.frequency.times });
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={readOnly}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={rule.title}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: done ? theme.accent : theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: done ? theme.accentSoft : theme.surfaceMuted }]}>
        <T style={styles.emoji}>{rule.icon}</T>
      </View>

      <View style={styles.text}>
        <T variant="bodyStrong" numberOfLines={1}>
          {rule.title}
        </T>
        <T variant="caption" numberOfLines={1}>
          {isAmount ? `${formatNumber(value)} / ${formatNumber(target)} ${rule.measure.kind === 'amount' ? rule.measure.unit : ''}` : subtitle}
          {isAmount && rule.frequency.kind === 'weekly' ? ` · ${subtitle}` : ''}
          {auto}
        </T>
        {isAmount && (
          <View style={[styles.bar, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: done ? theme.accent : theme.partial, width: `${Math.min(100, (value / target) * 100)}%` },
              ]}
            />
          </View>
        )}
      </View>

      {isAmount && !readOnly ? (
        <View style={styles.stepper}>
          <StepButton onPress={() => bump(-1)} disabled={value <= 0} label={t('today.row.less')}>
            <MinusIcon color={theme.text} size={16} />
          </StepButton>
          <StepButton onPress={() => bump(1)} label={t('today.row.more')} filled={done}>
            {done ? <CheckIcon color={theme.onAccent} size={16} /> : <PlusIcon color={theme.text} size={16} />}
          </StepButton>
        </View>
      ) : (
        <View
          style={[
            styles.check,
            done ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.border },
          ]}>
          {done && <CheckIcon color={theme.onAccent} />}
        </View>
      )}
    </Pressable>
  );
}

function StepButton({
  children,
  onPress,
  disabled,
  label,
  filled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: filled ? theme.accent : theme.surfaceMuted, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingRight: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  text: { flex: 1, gap: 2 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', gap: Spacing.two },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
});
