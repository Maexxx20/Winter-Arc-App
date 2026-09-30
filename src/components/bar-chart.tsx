import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { T } from './ui/text';

export interface Bar {
  label: string;
  /** 0..1 */
  ratio: number;
  /** Text beim Antippen, z. B. "5/7" */
  value: string;
  /** Laufende Woche o. Ä.: heller dargestellt */
  pending?: boolean;
}

/**
 * Schlichtes Säulendiagramm in einer Farbe: dünne Säulen mit runden Enden auf einer
 * gemeinsamen Grundlinie. Antippen zeigt den Wert; eine Säule kann hervorgehoben sein.
 */
export function BarChart({ bars, height = 120, highlight }: { bars: Bar[]; height?: number; highlight?: number | null }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const shown = selected ?? highlight ?? null;

  return (
    <View accessibilityRole="summary">
      <View style={[styles.plot, { height }]}>
        {/* Hilfslinien bei 50 % und 100 % */}
        <View style={[styles.grid, { bottom: height - 1, backgroundColor: theme.border }]} />
        <View style={[styles.grid, { bottom: height / 2, backgroundColor: theme.border, opacity: 0.6 }]} />
        {bars.map((b, i) => {
          const h = Math.max(b.ratio > 0 ? 4 : 0, b.ratio * height);
          const active = shown === i;
          return (
            <Pressable
              key={i}
              style={styles.col}
              onPress={() => setSelected(selected === i ? null : i)}
              accessibilityLabel={`${b.label}: ${b.value}`}
              hitSlop={4}>
              {active ? (
                <T variant="caption" color="text" style={[styles.value, { bottom: h + 4 }]} numberOfLines={1}>
                  {b.value}
                </T>
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: theme.accent,
                    opacity: b.pending ? 0.4 : active || shown === null ? 1 : 0.55,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.axis, { backgroundColor: theme.border }]} />
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <T key={i} variant="caption" color={shown === i ? 'text' : 'textTertiary'} center style={styles.label} numberOfLines={1}>
            {b.label}
          </T>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 22, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  value: { position: 'absolute', fontWeight: '700', fontSize: 12, width: 60, textAlign: 'center' },
  axis: { height: StyleSheet.hairlineWidth },
  labels: { flexDirection: 'row', gap: 4, marginTop: 4 },
  label: { flex: 1, fontSize: 11 },
});
