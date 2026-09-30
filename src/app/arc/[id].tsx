import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Heatmap, HeatmapLegend } from '@/components/heatmap';
import { ChevronIcon } from '@/components/icons';
import { StatTile } from '@/components/stat-tile';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { computeStats } from '@/lib/arc';
import { formatShort } from '@/lib/date';
import { useAppState } from '@/store/store';

/** Rückblick auf einen (auch früheren) Arc. */
export default function ArcDetail() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const arc = state.arcs.find((a) => a.id === id);
  const log = arc ? (state.logs[arc.id] ?? {}) : {};
  const stats = useMemo(() => (arc ? computeStats(arc, log, today) : null), [arc, log, today]);
  if (!arc || !stats) return null;
  const active = arc.id === state.activeArcId;

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Zurück" style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
          <ChevronIcon dir="left" color={theme.text} />
        </Pressable>
        <View style={styles.flex}>
          <T variant="label">
            {formatShort(arc.startDate)} – {formatShort(arc.endDate, true)}
          </T>
          <T variant="title" numberOfLines={2}>{arc.title}</T>
        </View>
      </View>

      {arc.why ? <T color="textSecondary" style={styles.why}>Weil: «{arc.why}»</T> : null}

      <View style={styles.tiles}>
        <StatTile label="Gehalten" value={`${stats.doneDays}`} sub={`von ${stats.evaluatedDays} Tagen`} />
        <StatTile label="Quote" value={stats.evaluatedDays ? `${Math.round(stats.completionRate * 100)}%` : '–'} sub="aller Tage" />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Bester Streak" value={`${stats.streak.best}`} sub="Tage am Stück" />
        <StatTile label="Schilde" value={`${stats.shieldedDays}`} sub="Tage gerettet" />
      </View>

      <Card style={styles.heat}>
        <Heatmap
          startDate={arc.startDate}
          endDate={arc.endDate}
          today={today}
          statuses={stats.streak.statuses}
          onPressDay={active ? (date) => router.push({ pathname: '/tag/[date]', params: { date } }) : undefined}
        />
        <HeatmapLegend />
      </Card>

      <SectionTitle>Regeln</SectionTitle>
      <Card style={styles.rules}>
        {stats.ruleStats.map(({ rule, consistency, expected }) => (
          <Pressable
            key={rule.id}
            onPress={() => router.push({ pathname: '/regel/[id]', params: { id: rule.id, arc: arc.id } })}
            style={({ pressed }) => [styles.rule, { opacity: pressed ? 0.7 : 1 }]}>
            <T style={styles.emoji}>{rule.icon}</T>
            <T variant="bodyStrong" style={styles.flex} numberOfLines={1}>{rule.title}</T>
            <T variant="bodyStrong">{expected ? `${Math.round(consistency * 100)}%` : '–'}</T>
            <ChevronIcon color={theme.textTertiary} size={14} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  why: { fontStyle: 'italic' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  heat: { gap: Spacing.four },
  rules: { gap: Spacing.four },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  emoji: { fontSize: 20, lineHeight: 26 },
});
