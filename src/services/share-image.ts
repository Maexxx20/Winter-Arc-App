import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Eine Ansicht als PNG teilen (bzw. im Browser herunterladen).
 * `width`/`height` = Grösse der Ansicht in Punkten; geteilt wird in 1080 px Breite.
 * Gibt false zurück, wenn Teilen auf dem Gerät nicht geht.
 */
export async function shareView(
  ref: RefObject<View | null>,
  { width, height, filename, dialogTitle }: { width: number; height: number; filename: string; dialogTitle: string },
): Promise<boolean> {
  if (Platform.OS === 'web') {
    const uri = await captureRef(ref, { format: 'png', result: 'data-uri' });
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
    return true;
  }
  const scale = 1080 / width;
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: Math.round(height * scale) });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
  return true;
}
