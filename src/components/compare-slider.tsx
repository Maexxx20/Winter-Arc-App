import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { usePhotoUri } from '@/services/photo-sync';

import { T } from './ui/text';

/**
 * Vorher/Nachher übereinander: Links vom Regler das Vorher, rechts das Nachher.
 * Ziehen verschiebt die Trennlinie.
 */
export function CompareSlider({ before, after, labels }: { before: string; after: string; labels: [string, string] }) {
  const theme = useTheme();
  const beforeUri = usePhotoUri(before);
  const afterUri = usePhotoUri(after);
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState(0.5);
  const widthRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => widthRef.current && setPos(Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current))),
      onPanResponderMove: (e) => widthRef.current && setPos(Math.min(1, Math.max(0, e.nativeEvent.locationX / widthRef.current))),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const height = width * (4 / 3);
  return (
    <View
      onLayout={onLayout}
      style={[styles.box, { height: height || 300, backgroundColor: theme.surfaceMuted }]}
      accessibilityLabel={t('progress.dragHint')}
      {...pan.panHandlers}>
      {afterUri ? <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" /> : null}
      <View pointerEvents="none" style={[styles.clip, { width: width * pos, height: height || 300 }]}>
        {beforeUri ? <Image source={{ uri: beforeUri }} style={{ width, height: height || 300 }} contentFit="cover" /> : null}
      </View>
      <View pointerEvents="none" style={[styles.line, { left: width * pos - 1.5 }]}>
        <View style={styles.knob}>
          <T style={styles.knobText}>⟷</T>
        </View>
      </View>
      <View pointerEvents="none" style={[styles.tag, styles.left]}>
        <T variant="caption" style={styles.tagText}>{labels[0]}</T>
      </View>
      <View pointerEvents="none" style={[styles.tag, styles.right]}>
        <T variant="caption" style={styles.tagText}>{labels[1]}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  clip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  knob: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  knobText: { color: '#111', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  tag: { position: 'absolute', top: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  left: { left: 10 },
  right: { right: 10 },
  tagText: { color: '#fff', fontWeight: '600' },
});
