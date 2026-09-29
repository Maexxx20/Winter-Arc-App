import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { deletePhoto, photoUri, pickPhoto } from '@/services/photos';

import { CloseIcon, PlusIcon } from './icons';
import { T } from './ui/text';

export const MAX_PHOTOS_PER_DAY = 4;

function chooseSource(): Promise<'camera' | 'library' | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');
  return new Promise((resolve) =>
    Alert.alert('Foto hinzufügen', undefined, [
      { text: 'Kamera', onPress: () => resolve('camera') },
      { text: 'Aus Galerie wählen', onPress: () => resolve('library') },
      { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) }),
  );
}

type Props = {
  photos: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
};

export function PhotoStrip({ photos, onAdd, onRemove }: Props) {
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
    if (!(await confirm('Foto löschen?', 'Das Foto wird aus deinem Tagebuch entfernt.', 'Löschen', true))) return;
    setViewing(null);
    onRemove(name);
    deletePhoto(name);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((p) => (
          <Pressable key={p} onPress={() => setViewing(p)} accessibilityLabel="Foto ansehen">
            <Image source={{ uri: photoUri(p) }} style={[styles.thumb, { backgroundColor: theme.surfaceMuted }]} contentFit="cover" />
          </Pressable>
        ))}
        {photos.length < MAX_PHOTOS_PER_DAY && (
          <Pressable
            onPress={add}
            disabled={busy}
            accessibilityLabel="Foto hinzufügen"
            style={({ pressed }) => [
              styles.thumb,
              styles.add,
              { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed || busy ? 0.6 : 1 },
            ]}>
            <PlusIcon color={theme.textSecondary} size={22} />
            <T variant="caption">Foto</T>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && <Image source={{ uri: photoUri(viewing) }} style={styles.full} contentFit="contain" />}
          <View style={[styles.viewerBar, { top: insets.top + Spacing.three }]}>
            <Pressable onPress={() => viewing && remove(viewing)} style={styles.viewerBtn} accessibilityLabel="Foto löschen">
              <T variant="bodyStrong" style={styles.white}>
                Löschen
              </T>
            </Pressable>
            <Pressable onPress={() => setViewing(null)} style={[styles.viewerBtn, styles.round]} accessibilityLabel="Schliessen">
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
