import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, type Palette } from '@/constants/theme';
import type { ArcStats } from '@/lib/arc';
import { addDays, diffDays, formatShort, weekStart } from '@/lib/date';
import type { Arc, DayStatus } from '@/lib/types';

import { ArcGauge } from './arc-gauge';

export const SHARE_W = 320;
export const SHARE_H = 568; // 9:16 – passt für Instagram-Storys

type Props = {
  arc: Arc;
  stats: ArcStats;
  dark?: boolean;
};

/** Die Karte, die als Bild geteilt wird. Feste Farben, unabhängig vom System-Theme. */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ arc, stats, dark }, ref) {
  const c: Palette = Colors[dark ? 'dark' : 'light'];
  const first = weekStart(arc.startDate);
  const weeks = Math.floor(diffDays(first, weekStart(arc.endDate)) / 7) + 1;

  const cellColor = (s: DayStatus | undefined) =>
    s === 'done' ? c.accent : s === 'partial' ? c.partial : s === 'shielded' ? c.shield : s === 'missed' ? c.missed : c.surfaceMuted;

  const txt = (size: number, color: string, weight: '400' | '600' | '700' = '400', extra = {}) => ({
    fontSize: size,
    color,
    fontWeight: weight,
    fontFamily: Fonts?.sans,
    ...extra,
  });

  const stat = (label: string, value: string) => (
    <View style={styles.stat}>
      <Text style={txt(24, c.text, '700', { letterSpacing: -0.5, fontVariant: ['tabular-nums'] })}>{value}</Text>
      <Text style={txt(10, c.textSecondary, '600', { letterSpacing: 0.8, textTransform: 'uppercase' })}>{label}</Text>
    </View>
  );

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: c.background }]}>
      <View style={styles.top}>
        <Text style={txt(11, c.accent, '700', { letterSpacing: 4 })}>NORDWAND</Text>
        <Text style={txt(20, c.text, '700', { letterSpacing: -0.4, marginTop: 4 })} numberOfLines={1}>
          {arc.title}
        </Text>
      </View>

      <View style={styles.gauge}>
        <ArcGauge
          palette={c}
          size={210}
          progress={Math.min(1, stats.dayNumber / stats.totalDays)}
          today={stats.streak.statuses[addDays(arc.startDate, stats.dayNumber - 1)] === 'done' ? 1 : 0}
          dayNumber={Math.min(stats.dayNumber, stats.totalDays)}
          totalDays={stats.totalDays}
        />
      </View>

      <View style={[styles.stats, { backgroundColor: c.surface, borderColor: c.border }]}>
        {stat('Streak', `${stats.streak.current}`)}
        <View style={[styles.sep, { backgroundColor: c.border }]} />
        {stat('Gehalten', `${stats.doneDays}`)}
        <View style={[styles.sep, { backgroundColor: c.border }]} />
        {stat('Quote', stats.evaluatedDays ? `${Math.round(stats.completionRate * 100)}%` : '–')}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: weeks }, (_, w) => (
          <View key={w} style={styles.col}>
            {Array.from({ length: 7 }, (_, d) => {
              const date = addDays(first, w * 7 + d);
              const inArc = date >= arc.startDate && date <= arc.endDate;
              return (
                <View
                  key={d}
                  style={[styles.cell, { backgroundColor: inArc ? cellColor(stats.streak.statuses[date]) : 'transparent' }]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <Text style={txt(11, c.textTertiary, '400', { textAlign: 'center' })}>
        {formatShort(arc.startDate)} – {formatShort(arc.endDate, true)} · Winter Arc
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SHARE_W,
    height: SHARE_H,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: { alignItems: 'center' },
  gauge: { alignItems: 'center', marginTop: 4 },
  stats: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  sep: { width: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  col: { gap: 4 },
  cell: { width: 14, height: 14, borderRadius: 4 },
});
