import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CloseIcon } from '@/components/icons';
import { SHARE_H, SHARE_W, ShareCard } from '@/components/share-card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { computeStats } from '@/lib/arc';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { selectActiveArc, selectLog, useAppState } from '@/store/store';

export default function ShareScreen() {
  const theme = useTheme();
  const systemDark = useIsDark();
  const today = useToday();
  const state = useAppState();
  const arc = selectActiveArc(state);
  const log = selectLog(state, arc?.id);
  const stats = useMemo(() => (arc ? computeStats(arc, log, today) : null), [arc, log, today]);
  const [style, setStyle] = useState<'light' | 'dark'>(systemDark ? 'dark' : 'light');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);
  if (!arc || !stats) return null;

  const share = async () => {
    setBusy(true);
    try {
      const scale = 1080 / SHARE_W;
      if (Platform.OS === 'web') {
        const uri = await captureRef(cardRef, { format: 'png', result: 'data-uri' });
        const a = document.createElement('a');
        a.href = uri;
        a.download = 'nordwand.png';
        a.click();
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: SHARE_H * scale });
      if (!(await Sharing.isAvailableAsync())) {
        await confirm('Teilen nicht möglich', 'Auf diesem Gerät ist Teilen nicht verfügbar.', 'OK');
        return;
      }
      haptic.success();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Fortschritt teilen' });
    } catch (e) {
      console.warn('Teilen fehlgeschlagen', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={Platform.OS !== 'ios'} footer={<Button title="Teilen" onPress={share} loading={busy} />}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">Tag {Math.min(stats.dayNumber, stats.totalDays)}</T>
          <T variant="title">Fortschritt teilen</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      <Segmented
        value={style}
        onChange={setStyle}
        options={[
          { value: 'light', label: 'Hell' },
          { value: 'dark', label: 'Dunkel' },
        ]}
      />

      <View style={[styles.preview, { borderColor: theme.border }]}>
        <ShareCard ref={cardRef} arc={arc} stats={stats} dark={style === 'dark'} />
      </View>

      <T variant="caption" color="textTertiary" center>
        Nur Zahlen und Farben – deine Regeln, Notizen und Fotos bleiben privat.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  preview: { alignSelf: 'center', borderRadius: 25, borderWidth: StyleSheet.hairlineWidth },
});
