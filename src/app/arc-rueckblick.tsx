import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { forwardRef, useMemo, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useToday } from '@/hooks/use-today';
import { formatNumber, t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { formatShort, weekdayName } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { type ArcRecap, buildRecap } from '@/lib/recap';
import { usePhotoUri } from '@/services/photo-sync';
import { shareView } from '@/services/share-image';
import { selectActiveArc, selectLog, selectReviews, useAppState } from '@/store/store';

const SHARE_W = 320;
const SHARE_H = 568;
const C = Colors.dark;

/** Arc-Rückblick wie eine kleine Story: eine Karte pro Erkenntnis, am Ende eine Karte zum Teilen. */
export default function ArcRecapScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const state = useAppState();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const arc = (id ? state.arcs.find((a) => a.id === id) : selectActiveArc(state)) ?? null;
  const log = selectLog(state, arc?.id);
  const reviews = selectReviews(state, arc?.id ?? '');
  const recap = useMemo(
    () => (arc ? buildRecap(arc, log, reviews, today) : null),
    [arc, log, reviews, today],
  );
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const shareRef = useRef<View>(null);

  if (!arc || !recap) return <View style={styles.root} />;

  const pct = (x: number) => Math.round(x * 100);
  const slides: { key: string; node: React.ReactNode }[] = [
    {
      key: 'intro',
      node: (
        <Slide kicker={recap.finished ? t('recap.title') : t('recap.interim')} big={arc.title} note={`${formatShort(recap.startDate)} – ${formatShort(recap.endDate, true)}`}>
          <Text style={[styles.text, styles.sub]}>{recap.finished ? t('recap.intro') : t('recap.introInterim')}</Text>
        </Slide>
      ),
    },
    {
      key: 'held',
      node: (
        <Slide kicker={t('recap.held')} big={t('recap.heldValue', { held: recap.heldDays, total: recap.finished ? recap.totalDays : recap.evaluatedDays })} note={t('recap.heldNote', { rate: pct(recap.rate) })} />
      ),
    },
    {
      key: 'streak',
      node: (
        <Slide
          kicker={t('recap.streak')}
          big={`🔥 ${recap.bestStreak}`}
          note={t('common.days', { count: recap.bestStreak })}
          extra={recap.shieldedDays ? t('recap.shieldNote', { count: recap.shieldedDays }) : undefined}
        />
      ),
    },
  ];
  if (recap.strongest) {
    slides.push({
      key: 'strongest',
      node: <Slide kicker={t('recap.strongest')} big={`${recap.strongest.rule.icon} ${recap.strongest.rule.title}`} note={t('recap.strongestNote', { rate: pct(recap.strongest.rate) })} />,
    });
  }
  if (recap.hardest) {
    slides.push({
      key: 'hardest',
      node: <Slide kicker={t('recap.hardest')} big={`${recap.hardest.rule.icon} ${recap.hardest.rule.title}`} note={t('recap.hardestNote', { rate: pct(recap.hardest.rate) })} />,
    });
  }
  if (recap.hardestWeekday !== null) {
    slides.push({
      key: 'weekday',
      node: (
        <Slide
          kicker={t('recap.weekday')}
          big={weekdayName(recap.hardestWeekday)}
          note={recap.bestWeekday !== null ? t('recap.weekdayNote', { day: weekdayName(recap.bestWeekday) }) : ''}
        />
      ),
    });
  }
  if (recap.amounts.length) {
    slides.push({
      key: 'amounts',
      node: (
        <Slide kicker={t('recap.amounts')} big={`${formatNumber(recap.amounts[0].total, 1)} ${recap.amounts[0].unit}`} note={`${recap.amounts[0].rule.icon} ${recap.amounts[0].rule.title}`}>
          {recap.amounts.slice(1, 3).map((a) => (
            <Text key={a.rule.id} style={[styles.text, styles.sub]}>
              {a.rule.icon} {formatNumber(a.total, 1)} {a.unit}
            </Text>
          ))}
        </Slide>
      ),
    });
  }
  if (recap.bestWeek) {
    slides.push({
      key: 'week',
      node: <Slide kicker={t('recap.bestWeek')} big={t('recap.bestWeekValue', { index: recap.bestWeek.index })} note={t('recap.bestWeekNote', { held: recap.bestWeek.held, days: recap.bestWeek.days })} />,
    });
  }
  if (recap.notes || recap.photos || recap.badges) {
    slides.push({
      key: 'journal',
      node: (
        <Slide kicker={t('recap.journal')} big={t('recap.badges', { count: recap.badges })} note="">
          <Text style={[styles.text, styles.sub]}>{t('recap.notes', { count: recap.notes })}</Text>
          <Text style={[styles.text, styles.sub]}>{t('recap.photos', { count: recap.photos })}</Text>
        </Slide>
      ),
    });
  }
  if (recap.progress) {
    slides.push({ key: 'progress', node: <ProgressSlide recap={recap} /> });
  }
  const ending = !recap.finished ? t('recap.endInterim') : recap.rate >= 0.8 ? t('recap.endStrong') : recap.rate >= 0.5 ? t('recap.endGood') : t('recap.endStart');
  slides.push({
    key: 'share',
    node: (
      <View style={styles.shareSlide}>
        <View style={styles.preview}>
          <RecapCard ref={shareRef} recap={recap} ending={ending} />
        </View>
      </View>
    ),
  });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const share = async () => {
    setBusy(true);
    try {
      haptic.success();
      const ok = await shareView(shareRef, { width: SHARE_W, height: SHARE_H, filename: 'nordwand-rueckblick.png', dialogTitle: t('recap.shareTitle', { title: arc.title }) });
      if (!ok) await confirm(t('common.error'), t('common.offline'), t('common.ok'));
    } catch (e) {
      console.warn('Teilen fehlgeschlagen', e);
    } finally {
      setBusy(false);
    }
  };

  const last = page >= slides.length - 1;
  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.bars}>
          {slides.map((s, i) => (
            <View key={s.key} style={[styles.bar, { backgroundColor: i <= page ? C.accent : 'rgba(255,255,255,0.18)' }]} />
          ))}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t('common.close')} style={styles.close}>
          <CloseIcon color="#fff" size={16} />
        </Pressable>
      </View>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
        {slides.map((s) => (
          <View key={s.key} style={{ width }}>
            {s.node}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.four }]}>
        {last ? (
          <>
            <Button title={t('recap.share')} onPress={share} loading={busy} />
            {recap.finished ? <Button title={t('recap.next')} variant="ghost" onPress={() => router.replace({ pathname: '/onboarding/create', params: { from: arc.id } })} /> : null}
          </>
        ) : (
          <Text style={[styles.text, styles.hint]}>{t('recap.swipe')}</Text>
        )}
      </View>
    </View>
  );
}

function Slide({ kicker, big, note, extra, children }: { kicker: string; big: string; note: string; extra?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.slide}>
      <Text style={[styles.text, styles.kicker]}>{kicker.toUpperCase()}</Text>
      <Text style={[styles.text, styles.big]} adjustsFontSizeToFit numberOfLines={3}>
        {big}
      </Text>
      {note ? <Text style={[styles.text, styles.note]}>{note}</Text> : null}
      {extra ? <Text style={[styles.text, styles.sub]}>{extra}</Text> : null}
      {children}
    </View>
  );
}

function ProgressSlide({ recap }: { recap: ArcRecap }) {
  const a = usePhotoUri(recap.progress!.first.name);
  const b = usePhotoUri(recap.progress!.last.name);
  return (
    <View style={styles.slide}>
      <Text style={[styles.text, styles.kicker]}>{t('recap.progress').toUpperCase()}</Text>
      <View style={styles.pair}>
        {[
          { uri: a, date: recap.progress!.first.date },
          { uri: b, date: recap.progress!.last.date },
        ].map((p) => (
          <View key={p.date + (p.uri ?? '')} style={styles.pairCol}>
            <View style={styles.pairPhoto}>{p.uri ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <Text style={[styles.text, styles.sub]}>{formatShort(p.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Story-Karte zum Teilen (9:16), nur Zahlen – keine Regeln-Details ausser Titel, keine Fotos. */
const RecapCard = forwardRef<View, { recap: ArcRecap; ending: string }>(function RecapCard({ recap, ending }, ref) {
  const row = (label: string, value: string) => (
    <View style={styles.cardRow}>
      <Text style={[styles.text, styles.cardValue]}>{value}</Text>
      <Text style={[styles.text, styles.cardLabel]}>{label.toUpperCase()}</Text>
    </View>
  );
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Text style={[styles.text, styles.brand]}>NORDWAND</Text>
      <Text style={[styles.text, styles.cardTitle]} numberOfLines={2}>
        {recap.title}
      </Text>
      <Text style={[styles.text, styles.cardDates]}>
        {formatShort(recap.startDate)} – {formatShort(recap.endDate, true)}
      </Text>
      <View style={styles.cardStats}>
        {row(t('recap.held'), t('recap.heldValue', { held: recap.heldDays, total: recap.finished ? recap.totalDays : recap.evaluatedDays }))}
        {row(t('recap.streak'), `🔥 ${recap.bestStreak}`)}
        {recap.strongest ? row(t('recap.strongest'), `${recap.strongest.rule.icon} ${recap.strongest.rule.title}`) : null}
        {recap.amounts[0] ? row(`${recap.amounts[0].rule.icon} ${recap.amounts[0].rule.title}`, `${formatNumber(recap.amounts[0].total, 1)} ${recap.amounts[0].unit}`) : null}
      </View>
      <Text style={[styles.text, styles.ending]}>{ending}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  text: { color: C.text, fontFamily: Fonts?.sans },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.five },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  slide: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.six, gap: Spacing.three },
  kicker: { color: C.accent, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  big: { fontSize: 46, lineHeight: 54, fontWeight: '800', letterSpacing: -1 },
  note: { fontSize: 18, lineHeight: 24, color: C.textSecondary },
  sub: { fontSize: 16, lineHeight: 22, color: C.textSecondary },
  hint: { textAlign: 'center', color: C.textTertiary, fontSize: 13 },
  bottom: { paddingHorizontal: Spacing.five, gap: Spacing.two },
  pair: { flexDirection: 'row', gap: Spacing.three, height: 300 },
  pairCol: { flex: 1, gap: 6 },
  pairPhoto: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: C.surfaceMuted },
  shareSlide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  preview: { transform: [{ scale: Platform.OS === 'web' ? 0.9 : 0.92 }] },
  card: { width: SHARE_W, height: SHARE_H, borderRadius: 24, backgroundColor: C.surface, padding: 26, gap: 10 },
  brand: { color: C.accent, fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  cardTitle: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 8 },
  cardDates: { color: C.textSecondary, fontSize: 13 },
  cardStats: { flex: 1, justifyContent: 'center', gap: 18 },
  cardRow: { gap: 2 },
  cardValue: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  cardLabel: { color: C.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  ending: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.accent },
});
