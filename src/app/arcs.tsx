import { router } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon, CloseIcon } from '@/components/icons';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { computeStats } from '@/lib/arc';
import { formatShort } from '@/lib/date';
import { useAppState } from '@/store/store';

const STATUS: Record<string, string> = { active: 'läuft', finished: 'beendet', abandoned: 'abgebrochen' };

/** Alle Arcs, neuester zuerst. */
export default function ArcsScreen() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const list = useMemo(
    () =>
      [...state.arcs]
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((a) => ({ arc: a, stats: computeStats(a, state.logs[a.id] ?? {}, today) })),
    [state.arcs, state.logs, today],
  );

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">Nordwand</T>
          <T variant="title">Deine Arcs</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {list.map(({ arc, stats }) => {
        const active = arc.id === state.activeArcId;
        return (
          <Pressable
            key={arc.id}
            onPress={() => router.push({ pathname: '/arc/[id]', params: { id: arc.id } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border, opacity: pressed ? 0.8 : 1 },
            ]}>
            <View style={styles.flex}>
              <T variant="bodyStrong" numberOfLines={1}>{arc.title}</T>
              <T variant="caption">
                {formatShort(arc.startDate)} – {formatShort(arc.endDate, true)} · {active ? 'läuft' : STATUS[arc.status]}
              </T>
              {stats.started ? (
                <T variant="caption" color="textTertiary">
                  {stats.doneDays} Tage gehalten · {Math.round(stats.completionRate * 100)} % · Rekord {stats.streak.best}
                </T>
              ) : (
                <T variant="caption" color="textTertiary">Startet am {formatShort(arc.startDate)}</T>
              )}
            </View>
            <ChevronIcon color={theme.textTertiary} size={16} />
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.md, borderWidth: 1.5 },
});
