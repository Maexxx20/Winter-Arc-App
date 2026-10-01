import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, diffDays, type ISODate, monthName, parseISO, weekdayShortNames, weekStart } from '@/lib/date';
import type { DayStatus } from '@/lib/types';

import { T } from './ui/text';

type Props = {
  startDate: ISODate;
  endDate: ISODate;
  today: ISODate;
  statuses: Record<ISODate, DayStatus>;
  onPressDay?: (date: ISODate) => void;
};

export function Heatmap({ startDate, endDate, today, statuses, onPressDay }: Props) {
  const theme = useTheme();
  const first = weekStart(startDate);
  const weeks = Math.floor(diffDays(first, weekStart(endDate)) / 7) + 1;

  const colorFor = (s: DayStatus | undefined): { bg: string; fg: string; border?: string } => {
    switch (s) {
      case 'done':
        return { bg: theme.accent, fg: theme.onAccent };
      case 'partial':
        return { bg: theme.partial, fg: theme.onAccent };
      case 'shielded':
        return { bg: theme.shield, fg: '#FFFFFF' };
      case 'missed':
        return { bg: theme.missed, fg: theme.textSecondary };
      case 'open':
        return { bg: theme.surface, fg: theme.accent, border: theme.accent };
      case 'neutral':
        return { bg: theme.surfaceMuted, fg: theme.textSecondary };
      case 'future':
        return { bg: theme.surfaceMuted, fg: theme.textTertiary };
      default:
        return { bg: 'transparent', fg: 'transparent' };
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.monthCol} />
        {weekdayShortNames().map((d) => (
          <View key={d} style={styles.cellWrap}>
            <T variant="caption" color="textTertiary" center style={styles.wd}>
              {d}
            </T>
          </View>
        ))}
      </View>

      {Array.from({ length: weeks }, (_, w) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i));
        const firstOfMonth = days.find((d) => d.endsWith('-01') && d >= startDate && d <= endDate);
        const label = w === 0 ? monthName(startDate) : firstOfMonth ? monthName(firstOfMonth) : '';
        return (
          <View key={w} style={styles.row}>
            <View style={styles.monthCol}>
              {label ? (
                <T variant="caption" color="textSecondary" numberOfLines={1} style={styles.month}>
                  {label.slice(0, 3)}
                </T>
              ) : null}
            </View>
            {days.map((d) => {
              const inArc = d >= startDate && d <= endDate;
              const s = inArc ? statuses[d] : undefined;
              const c = colorFor(s);
              const tappable = inArc && d <= today && !!onPressDay;
              return (
                <View key={d} style={styles.cellWrap}>
                  <Pressable
                    disabled={!tappable}
                    onPress={() => onPressDay?.(d)}
                    accessibilityLabel={inArc ? `${d}: ${s}` : undefined}
                    style={({ pressed }) => [
                      styles.cell,
                      {
                        backgroundColor: c.bg,
                        borderColor: c.border ?? 'transparent',
                        opacity: pressed ? 0.7 : s === 'future' ? 0.6 : 1,
                      },
                    ]}>
                    {inArc && (
                      <T style={[styles.num, { color: c.fg }]}>{parseISO(d).getDate()}</T>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function HeatmapLegend() {
  const theme = useTheme();
  const items: [string, string][] = [
    [theme.accent, 'Gehalten'],
    [theme.partial, 'Teilweise'],
    [theme.shield, 'Schild'],
    [theme.missed, 'Verpasst'],
  ];
  return (
    <View style={styles.legend}>
      {items.map(([color, label]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <T variant="caption">{label}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  monthCol: { width: 30 },
  month: { fontSize: 11 },
  cellWrap: { flex: 1 },
  cell: {
    aspectRatio: 1,
    borderRadius: Radius.sm - 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wd: { fontSize: 11 },
  num: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
});
