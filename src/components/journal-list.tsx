import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import type { ArcLog } from '@/lib/arc';
import { formatLong, type ISODate } from '@/lib/date';
import { usePhotoUri } from '@/services/photo-sync';

import { SectionTitle } from './ui/controls';
import { T } from './ui/text';

const PAGE = 5;

/** Tagebuch im Verlauf: Tage mit Notiz oder Fotos, neueste zuerst. */
export function JournalList({ arcId, log, today }: { arcId: string; log: ArcLog; today: ISODate }) {
  const theme = useTheme();
  const [shown, setShown] = useState(PAGE);
  const days = useMemo(
    () =>
      Object.entries(log)
        .filter(([date, e]) => date <= today && (e.note?.trim() || e.photos?.length))
        .sort(([a], [b]) => b.localeCompare(a)),
    [log, today],
  );
  if (!days.length) return null;

  return (
    <>
      <SectionTitle>{t('history.journal.title')}</SectionTitle>
      <View style={styles.list}>
        {days.slice(0, shown).map(([date, e]) => (
          <Pressable
            key={date}
            onPress={() => router.push({ pathname: '/tag/[date]', params: { date, arc: arcId } })}
            style={({ pressed }) => [styles.item, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}>
            <T variant="label">{formatLong(date)}</T>
            {e.note?.trim() ? (
              <T numberOfLines={3} color="textSecondary">
                {e.note.trim()}
              </T>
            ) : null}
            {e.photos?.length ? (
              <View style={styles.photos}>
                {e.photos.map((p) => (
                  <Thumb key={p} name={p} />
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
        {days.length > shown ? (
          <Pressable onPress={() => setShown((n) => n + PAGE)} hitSlop={8} style={styles.more}>
            <T variant="caption" color="accent">{t('history.journal.more')}</T>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function Thumb({ name }: { name: string }) {
  const theme = useTheme();
  const uri = usePhotoUri(name);
  return (
    <View style={[styles.thumb, { backgroundColor: theme.surfaceMuted }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  item: { gap: Spacing.two, padding: Spacing.four, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  photos: { flexDirection: 'row', gap: Spacing.two },
  thumb: { width: 72, height: 96, borderRadius: Radius.sm, overflow: 'hidden' },
  more: { alignSelf: 'center', paddingVertical: Spacing.two },
});
