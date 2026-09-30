import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { uid } from '@/lib/arc';

/** Profilbilder liegen wie Fotos im Dokumentenordner, als relativer Name ("profile/…jpg"). */
const DIR = 'profile';

function dir() {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/**
 * Bild aus Kamera oder Galerie wählen, quadratisch zuschneiden lassen und
 * auf 512 px verkleinern (klein genug für den Upload, scharf genug für die Anzeige).
 */
export async function pickAvatar(source: 'camera' | 'library'): Promise<string | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;

  const context = ImageManipulator.manipulate(res.assets[0].uri);
  const rendered = await context.resize({ width: 512, height: null }).renderAsync();
  try {
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
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

/** Inhalt für den Upload. */
export async function avatarBytes(name: string): Promise<ArrayBuffer> {
  const bytes = await new File(Paths.document, name).bytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
