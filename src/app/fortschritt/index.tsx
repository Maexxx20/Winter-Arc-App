import { Image } from 'expo-image';
import { router } from 'expo-router';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CompareSlider } from '@/components/compare-slider';
import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, SectionTitle } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { diffDays, formatShort } from '@/lib/date';
import { type DiaryPhoto, diaryPhotos } from '@/lib/photo-merge';
import { usePhotoUri } from '@/services/photo-sync';
import { shareView } from '@/services/share-image';
import { selectActiveArc, useAppState } from '@/store/store';

type ProgressPhoto = DiaryPhoto;

const SHARE_W = 320;
const SHARE_H = 400;

/** Vorher/Nachher aus den Tagebuch-Fotos: Vergleich, Zeitraffer, alle Fotos. Nur für dich. */
export default function ProgressScreen() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const active = selectActiveArc(state);
  // Arcs mit Fotos (neuester zuerst); Standard: der laufende Arc, sonst alle
  const arcsWithPhotos = useMemo(() => {
    const ids = new Set(diaryPhotos(state).map((p) => p.arcId));
    return state.arcs.filter((a) => ids.has(a.id)).reverse();
  }, [state]);
  const [scope, setScope] = useState<string | null>(null);
  const arcId = scope === 'all' ? undefined : (scope ?? (active && arcsWithPhotos.some((a) => a.id === active.id) ? active.id : undefined));
  const photos = useMemo(() => diaryPhotos(state, arcId), [state, arcId]);
  const canAddToday = !!active && today >= active.startDate && today <= active.endDate;
  const [beforeName, setBeforeName] = useState<string | null>(null);
  const [afterName, setAfterName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [busy, setBusy] = useState(false);
  const shareRef = useRef<View>(null);

  const before = photos.find((p) => p.name === beforeName) ?? photos[0];
  const after = photos.find((p) => p.name === afterName) ?? photos[photos.length - 1];

  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % photos.length), 650);
    return () => clearInterval(id);
  }, [playing, photos.length]);

  const openDay = (p: ProgressPhoto) => router.push({ pathname: '/tag/[date]', params: { date: p.date, arc: p.arcId } });

  const choose = (p: ProgressPhoto) => {
    if (Platform.OS === 'web') {
      setAfterName(p.name);
      return;
    }
    Alert.alert(formatShort(p.date, true), undefined, [
      { text: t('progress.setBefore'), onPress: () => setBeforeName(p.name) },
      { text: t('progress.setAfter'), onPress: () => setAfterName(p.name) },
      { text: t('progress.openDay'), onPress: () => openDay(p) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const share = async () => {
    setBusy(true);
    try {
      const ok = await shareView(shareRef, { width: SHARE_W, height: SHARE_H, filename: 'nordwand-vorher-nachher.png', dialogTitle: t('progress.shareTitle') });
      if (!ok) await confirm(t('common.error'), t('common.offline'), t('common.ok'));
    } catch (e) {
      console.warn('Teilen fehlgeschlagen', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">{t('progress.count', { count: photos.length })}</T>
          <T variant="title">{t('progress.title')}</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {photos.length < 2 ? (
        <Card tone="accentSoft" bordered={false} style={styles.gap}>
          <T>{t('progress.intro')}</T>
          <T variant="caption">{t('progress.private')}</T>
        </Card>
      ) : null}

      {canAddToday ? (
        <Button
          title={t('progress.addToday')}
          variant={photos.length < 2 ? 'primary' : 'secondary'}
          onPress={() => router.push({ pathname: '/tag/[date]', params: { date: today } })}
        />
      ) : null}

      {arcsWithPhotos.length > 1 ? (
        <View style={styles.chips}>
          <Chip label={t('progress.allArcs')} selected={arcId === undefined} onPress={() => setScope('all')} />
          {arcsWithPhotos.map((a) => (
            <Chip key={a.id} label={a.title} selected={arcId === a.id} onPress={() => setScope(a.id)} />
          ))}
        </View>
      ) : null}

      {before && after && before.name !== after.name ? (
        <>
          <SectionTitle
            action={
              <T variant="caption" color="textSecondary">
                {t('progress.between', { count: Math.abs(diffDays(before.date, after.date)) })}
              </T>
            }>
            {t('progress.compare')}
          </SectionTitle>
          <CompareSlider
            before={before.name}
            after={after.name}
            labels={[`${t('progress.before')} · ${formatShort(before.date)}`, `${t('progress.after')} · ${formatShort(after.date)}`]}
          />
          <T variant="caption" color="textTertiary" center>
            {t('progress.pickHint')}
          </T>
          <Button title={t('progress.shareCompare')} variant="secondary" loading={busy} onPress={share} />
          <T variant="caption" color="textTertiary" center>
            {t('progress.shareNote')}
          </T>

          <SectionTitle
            action={
              <Pressable onPress={() => setPlaying((p) => !p)} hitSlop={8}>
                <T variant="caption" color="accent">{playing ? t('progress.stop') : t('progress.play')}</T>
              </Pressable>
            }>
            {t('progress.timelapse')}
          </SectionTitle>
          <TimelapseFrame photo={photos[playing ? frame : photos.length - 1]} />
        </>
      ) : null}

      {photos.length ? (
        <>
          <SectionTitle>{t('progress.all')}</SectionTitle>
          <View style={styles.grid}>
            {[...photos].reverse().map((p) => (
              <Thumb key={p.name} photo={p} selected={p.name === before?.name || p.name === after?.name} onPress={() => choose(p)} />
            ))}
          </View>
        </>
      ) : null}

      {before && after && before.name !== after.name ? (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareComposite ref={shareRef} before={before} after={after} />
        </View>
      ) : null}
    </Screen>
  );
}

function Thumb({ photo, selected, onPress }: { photo: ProgressPhoto; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const uri = usePhotoUri(photo.name);
  return (
    <Pressable onPress={onPress} style={[styles.thumb, { borderColor: selected ? theme.accent : 'transparent', backgroundColor: theme.surfaceMuted }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={styles.thumbLabel}>
        <T variant="caption" style={styles.thumbText}>{formatShort(photo.date)}</T>
      </View>
    </Pressable>
  );
}

function TimelapseFrame({ photo }: { photo: ProgressPhoto | undefined }) {
  const theme = useTheme();
  const uri = usePhotoUri(photo?.name ?? '');
  if (!photo) return null;
  return (
    <View style={[styles.frame, { backgroundColor: theme.surfaceMuted }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <View style={styles.thumbLabel}>
        <T variant="caption" style={styles.thumbText}>{formatShort(photo.date, true)}</T>
      </View>
    </View>
  );
}

/** Bild zum Teilen: Vorher und Nachher nebeneinander, mit Daten. */
const ShareComposite = forwardRef<View, { before: ProgressPhoto; after: ProgressPhoto }>(function ShareComposite({ before, after }, ref) {
  const c = Colors.dark;
  const b = usePhotoUri(before.name);
  const a = usePhotoUri(after.name);
  const txt = { fontFamily: Fonts?.sans, color: c.text } as const;
  return (
    <View ref={ref} collapsable={false} style={[styles.share, { backgroundColor: c.background }]}>
      <Text style={[txt, styles.shareBrand, { color: c.accent }]}>NORDWAND</Text>
      <View style={styles.shareRow}>
        {[
          { uri: b, label: t('progress.before'), date: before.date },
          { uri: a, label: t('progress.after'), date: after.date },
        ].map((x) => (
          <View key={x.label} style={styles.shareCol}>
            <View style={[styles.sharePhoto, { backgroundColor: c.surfaceMuted }]}>
              {x.uri ? <Image source={{ uri: x.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <Text style={[txt, styles.shareLabel]}>{x.label}</Text>
            <Text style={[txt, styles.shareDate, { color: c.textSecondary }]}>{formatShort(x.date, true)}</Text>
          </View>
        ))}
      </View>
      <Text style={[txt, styles.shareFoot, { color: c.textSecondary }]}>{t('progress.between', { count: Math.abs(diffDays(before.date, after.date)) })}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { width: '31.8%', aspectRatio: 3 / 4, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 2.5 },
  thumbLabel: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  thumbText: { color: '#fff', fontWeight: '600' },
  frame: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offscreen: { position: 'absolute', left: -4000, top: 0 },
  share: { width: SHARE_W, height: SHARE_H, padding: 18, gap: 12 },
  shareBrand: { fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  shareRow: { flexDirection: 'row', gap: 10, flex: 1 },
  shareCol: { flex: 1, gap: 4 },
  sharePhoto: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  shareLabel: { fontSize: 15, fontWeight: '700' },
  shareDate: { fontSize: 11 },
  shareFoot: { fontSize: 11, textAlign: 'center' },
});
