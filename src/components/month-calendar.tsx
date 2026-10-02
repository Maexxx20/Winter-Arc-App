import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { addDays, formatShort, type ISODate, maxISO, minISO, monthName, parseISO, weekdayShortNames, weekStart } from '@/lib/date';
import type { ArcLog } from '@/lib/arc';
import type { DayStatus } from '@/lib/types';
import { usePhotoUri } from '@/services/photo-sync';

import { ChevronIcon } from './icons';
import { T } from './ui/text';

type Props = {
  startDate: ISODate;
  endDate: ISODate;
  today: ISODate;
  statuses: Record<ISODate, DayStatus>;
  /** Für Fotos und Notizen in den Feldern */
  log: ArcLog;
  onPressDay?: (date: ISODate) => void;
};

const firstOfMonth = (iso: ISODate) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: ISODate, n: number) => {
  const d = parseISO(firstOfMonth(iso));
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Kalender wie im Handy: ein Monat, Wochentage oben, gehaltene Tage farbig, Fotos als kleines Bild. */
export function MonthCalendar({ startDate, endDate, today, statuses, log, onPressDay }: Props) {
  const theme = useTheme();
  const firstMonth = firstOfMonth(startDate);
  const lastMonth = firstOfMonth(endDate);
  const [month, setMonth] = useState(() => firstOfMonth(minISO(maxISO(today, startDate), endDate)));

  const gridStart = weekStart(month);
  const nextMonth = addMonths(month, 1);
  const weeks: ISODate[][] = [];
  for (let w = 0; w < 6; w++) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i));
    if (w > 0 && days[0] >= nextMonth) break;
    weeks.push(days);
  }

  const colors = (s: DayStatus | undefined) => {
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
      default:
        return { bg: theme.surfaceMuted, fg: theme.textTertiary };
    }
  };

  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;
  const year = month.slice(0, 4);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          onPress={() => canPrev && setMonth(addMonths(month, -1))}
          disabled={!canPrev}
          hitSlop={10}
          accessibilityLabel={t('history.calendar.prev')}
          style={[styles.nav, { backgroundColor: theme.surfaceMuted, opacity: canPrev ? 1 : 0.3 }]}>
          <ChevronIcon dir="left" color={theme.text} size={16} />
        </Pressable>
        <T variant="heading" center style={styles.title}>
          {monthName(month)} {year}
        </T>
        <Pressable
          onPress={() => canNext && setMonth(addMonths(month, 1))}
          disabled={!canNext}
          hitSlop={10}
          accessibilityLabel={t('history.calendar.next')}
          style={[styles.nav, { backgroundColor: theme.surfaceMuted, opacity: canNext ? 1 : 0.3 }]}>
          <ChevronIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {weekdayShortNames().map((d) => (
          <T key={d} variant="caption" color="textTertiary" center style={styles.wd}>
            {d}
          </T>
        ))}
      </View>

      {weeks.map((days) => (
        <View key={days[0]} style={styles.row}>
          {days.map((d) => {
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            if (!inMonth) return <View key={d} style={styles.cellWrap} />;
            const inArc = d >= startDate && d <= endDate;
            const s = inArc ? statuses[d] : undefined;
            const c = colors(s);
            const photo = inArc ? log[d]?.photos?.[0] : undefined;
            const hasNote = inArc && !!log[d]?.note?.trim();
            const tappable = inArc && d <= today && !!onPressDay;
            const label = s ? `${formatShort(d)}: ${t(`history.status.${s}`)}` : formatShort(d);
            return (
              <View key={d} style={styles.cellWrap}>
                <Pressable
                  disabled={!tappable}
                  onPress={() => onPressDay?.(d)}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      backgroundColor: inArc ? c.bg : 'transparent',
                      borderColor: photo ? c.bg : (c.border ?? 'transparent'),
                      borderWidth: photo ? 2.5 : 1.5,
                      opacity: pressed ? 0.7 : s === 'future' ? 0.55 : 1,
                    },
                  ]}>
                  {photo ? <DayPhoto name={photo} /> : null}
                  <T
                    style={[
                      styles.num,
                      { color: photo ? '#FFFFFF' : inArc ? c.fg : theme.textTertiary },
                      photo && styles.numOnPhoto,
                      d === today && styles.today,
                    ]}>
                    {parseISO(d).getDate()}
                  </T>
                  {hasNote && !photo ? <View style={[styles.noteDot, { backgroundColor: c.fg }]} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayPhoto({ name }: { name: string }) {
  const uri = usePhotoUri(name);
  if (!uri) return null;
  return <Image source={{ uri }} style={[StyleSheet.absoluteFill, styles.photo]} contentFit="cover" />;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.one },
  title: { flex: 1 },
  nav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, fontSize: 12 },
  cellWrap: { flex: 1 },
  cell: { aspectRatio: 1, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { borderRadius: Radius.sm - 3 },
  num: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  numOnPhoto: { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
  today: { textDecorationLine: 'underline' },
  noteDot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },
});
