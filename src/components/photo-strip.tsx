import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { usePhotoUri } from '@/services/photo-sync';
import { deletePhoto, pickPhoto } from '@/services/photos';

import { CloseIcon, PlusIcon } from './icons';
import { T } from './ui/text';

export const MAX_PHOTOS_PER_DAY = 4;

function chooseSource(): Promise<'camera' | 'library' | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) =>
    Alert.alert(t('history.photo.add'), undefined, [
      { text: t('history.photo.camera'), onPress: () => resolve('camera') },
      { text: t('history.photo.library'), onPress: () => resolve('library') },
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) }),
  );
}

type Props = {
  photos: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  /** Nur ansehen (vergangene Tage) */
  readOnly?: boolean;
};

export function PhotoStrip({ photos, onAdd, onRemove, readOnly }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const source = await chooseSource();
    if (!source) return;
    setBusy(true);
    try {
      const name = await pickPhoto(source);
      if (name) {
        haptic.success();
        onAdd(name);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    if (!(await confirm(t('history.photo.deleteTitle'), t('history.photo.deleteBody'), t('common.delete'), true))) return;
    setViewing(null);
    onRemove(name);
    deletePhoto(name);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((p) => (
          <Pressable key={p} onPress={() => setViewing(p)} accessibilityLabel={t('history.photo.view')}>
            <PhotoImage name={p} style={[styles.thumb, { backgroundColor: theme.surfaceMuted }]} contentFit="cover" />
          </Pressable>
        ))}
        {!readOnly && photos.length < MAX_PHOTOS_PER_DAY && (
          <Pressable
            onPress={add}
            disabled={busy}
            accessibilityLabel={t('history.photo.add')}
            style={({ pressed }) => [
              styles.thumb,
              styles.add,
              { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed || busy ? 0.6 : 1 },
            ]}>
            <PlusIcon color={theme.textSecondary} size={22} />
            <T variant="caption">{t('history.photo.short')}</T>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && <PhotoImage name={viewing} style={styles.full} contentFit="contain" />}
          <View style={[styles.viewerBar, { top: insets.top + Spacing.three }]}>
            {readOnly ? (
              <View />
            ) : (
              <Pressable onPress={() => viewing && remove(viewing)} style={styles.viewerBtn} accessibilityLabel={t('history.photo.delete')}>
                <T variant="bodyStrong" style={styles.white}>
                  {t('common.delete')}
                </T>
              </Pressable>
            )}
            <Pressable onPress={() => setViewing(null)} style={[styles.viewerBtn, styles.round]} accessibilityLabel={t('common.close')}>
              <CloseIcon color="#fff" size={18} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  thumb: { width: 96, height: 128, borderRadius: Radius.md },
  add: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  full: { width: '100%', height: '80%' },
  viewerBar: { position: 'absolute', left: Spacing.five, right: Spacing.five, flexDirection: 'row', justifyContent: 'space-between' },
  viewerBtn: { paddingHorizontal: Spacing.four, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center' },
  round: { width: 40, paddingHorizontal: 0, alignItems: 'center' },
  white: { color: '#fff' },
});

/** Foto vom Gerät oder – auf einem neuen Handy – aus dem Konto. */
function PhotoImage({ name, ...rest }: { name: string } & Omit<ImageProps, 'source'>) {
  const uri = usePhotoUri(name);
  return <Image {...rest} source={uri ? { uri, cacheKey: name } : undefined} transition={150} />;
}
