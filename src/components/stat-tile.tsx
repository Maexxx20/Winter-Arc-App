import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { T } from './ui/text';

export function StatTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.top}>
        <T variant="label" numberOfLines={1} style={styles.label}>
          {label}
        </T>
        {icon}
      </View>
      <T variant="number" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {sub ? (
        <T variant="caption" color="textTertiary" numberOfLines={1}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
    minWidth: 0,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  label: { fontSize: 11, flexShrink: 1 },
});
