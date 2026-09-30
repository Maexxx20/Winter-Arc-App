import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
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

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return null;

  // Auf max. 1600 px (längere Seite) verkleinern: spart Platz auf dem Handy und beim Sync (~300 KB).
  let context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context = context.resize(asset.width >= asset.height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
    const name = `${uid()}.jpg`;
    const tmp = new File(saved.uri);
    tmp.copySync(new File(dir(), name));
    if (tmp.exists) tmp.delete();
    return `${DIR}/${name}`;
  } finally {
    rendered.release();
    context.release();
  }
}

const MAX_SIDE = 1600;

/** Liegt das Foto auf diesem Gerät? (Auf einem neuen Handy kommt es erst aus dem Konto.) */
export function photoExists(name: string): boolean {
  if (/^(file|data|blob|https?):/.test(name)) return true;
  try {
    return new File(Paths.document, name).exists;
  } catch {
    return false;
  }
}

export async function photoBytes(name: string): Promise<ArrayBuffer> {
  const bytes = await new File(Paths.document, name).bytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function deletePhoto(name: string) {
  try {
    const f = new File(Paths.document, name);
    if (f.exists) f.delete();
  } catch {
    // egal – Datei ist schon weg
  }
}
