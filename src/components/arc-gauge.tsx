import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

import { T } from './ui/text';

const SWEEP = 260; // Grad – unten offen, wie ein Bogen
const START = -SWEEP / 2;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

type Props = {
  /** 0..1 – Fortschritt durch den Arc */
  progress: number;
  /** 0..1 – Fortschritt heute */
  today: number;
  dayNumber: number;
  totalDays: number;
  label?: string;
  /** Text unter der Zahl; Standard "von N". */
  sub?: string;
  size?: number;
};

export function ArcGauge({ progress, today, dayNumber, totalDays, label = 'Tag', sub, size = 260 }: Props) {
  const theme = useTheme();
  const c = size / 2;
  const outerW = 14;
  const innerW = 6;
  const rOuter = c - outerW / 2 - 2;
  const rInner = rOuter - outerW - 8;

  const p = Math.min(1, Math.max(0, progress));
  const t = Math.min(1, Math.max(0, today));
  const end = START + SWEEP;
  const dot = polar(c, c, rOuter, START + SWEEP * p);

  return (
    <View style={{ width: size, height: size * 0.86 }} accessibilityLabel={`${label} ${dayNumber} von ${totalDays}`}>
      <Svg width={size} height={size}>
        <Path d={arcPath(c, c, rOuter, START, end)} stroke={theme.surfaceMuted} strokeWidth={outerW} strokeLinecap="round" fill="none" />
        {p > 0.001 && (
          <Path d={arcPath(c, c, rOuter, START, START + SWEEP * p)} stroke={theme.accent} strokeWidth={outerW} strokeLinecap="round" fill="none" />
        )}
        {p > 0.001 && p < 1 && <Circle cx={dot.x} cy={dot.y} r={outerW / 2 + 3} fill={theme.surface} stroke={theme.accent} strokeWidth={3} />}

        <Path d={arcPath(c, c, rInner, START, end)} stroke={theme.surfaceMuted} strokeWidth={innerW} strokeLinecap="round" fill="none" />
        {t > 0.001 && (
          <Path
            d={arcPath(c, c, rInner, START, START + SWEEP * Math.min(t, 0.9999))}
            stroke={t >= 1 ? theme.accent : theme.partial}
            strokeWidth={innerW}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { height: size }]}>
        <T variant="label">{label}</T>
        <T variant="hero">{dayNumber}</T>
        <T variant="caption" color="textTertiary">
          {sub ?? `von ${totalDays}`}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
