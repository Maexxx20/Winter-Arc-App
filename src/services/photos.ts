import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { uid } from '@/lib/arc';

/**
 * Fotos liegen im Dokumentenordner der App. Gespeichert wird nur der relative
 * Name ("photos/…jpg"), weil sich der absolute Pfad auf iOS bei Updates ändert.
 */
const DIR = 'photos';

function dir() {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function photoUri(name: string): string {
  if (/^(file|data|blob|https?):/.test(name)) return name;
  return new File(Paths.document, name).uri;
}

/** Öffnet Kamera oder Galerie und speichert das Bild. Gibt den relativen Namen zurück oder null. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;

  const name = `${uid()}.jpg`;
  const src = new File(res.assets[0].uri);
  src.copySync(new File(dir(), name));
  return `${DIR}/${name}`;
}

export function deletePhoto(name: string) {
  try {
    const f = new File(Paths.document, name);
    if (f.exists) f.delete();
  } catch {
    // egal – Datei ist schon weg
  }
}
