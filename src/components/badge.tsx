import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { BADGES, type BadgeDef, type BadgeId } from '@/lib/badges';
import { formatShort, type ISODate } from '@/lib/date';

import { T } from './ui/text';

/** Rundes Abzeichen; gesperrt = grau und durchsichtig. */
export function BadgeMedal({ badge, earned, size = 56 }: { badge: BadgeDef; earned: boolean; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: earned ? theme.accentSoft : theme.surfaceMuted,
          borderColor: earned ? theme.accent : theme.border,
          opacity: earned ? 1 : 0.45,
        },
      ]}>
      <T style={{ fontSize: size * 0.46, lineHeight: size * 0.6 }}>{earned ? badge.icon : '🔒'}</T>
    </View>
  );
}

/** Raster aller Abzeichen, verdiente zuerst. */
export function BadgeGrid({ earned }: { earned: Map<BadgeId, { count: number; first: ISODate }> }) {
  const sorted = [...BADGES.filter((b) => earned.has(b.id)), ...BADGES.filter((b) => !earned.has(b.id))];
  return (
    <View style={styles.grid}>
      {sorted.map((b) => {
        const e = earned.get(b.id);
        return (
          <View key={b.id} style={styles.cell} accessible accessibilityLabel={t('history.badges.a11y', { title: b.title, state: e ? t('history.badges.earned') : t('history.badges.locked'), description: b.description })}>
            <View>
              <BadgeMedal badge={b} earned={!!e} />
              {e && e.count > 1 ? (
                <View style={styles.count}>
                  <T variant="caption" style={styles.countText}>×{e.count}</T>
                </View>
              ) : null}
            </View>
            <T variant="caption" color={e ? 'text' : 'textTertiary'} center numberOfLines={2} style={styles.title}>
              {b.title}
            </T>
            <T variant="caption" color="textTertiary" center numberOfLines={1} style={styles.sub}>
              {e ? formatShort(e.first) : b.hint}
            </T>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.four },
  cell: { width: '33.33%', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  title: { fontWeight: '600', marginTop: 4 },
  sub: { fontSize: 11, lineHeight: 14 },
  count: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    backgroundColor: '#2657D9',
    borderRadius: Radius.md,
    paddingHorizontal: 5,
  },
  countText: { color: '#fff', fontWeight: '700', fontSize: 11, lineHeight: 16 },
});
