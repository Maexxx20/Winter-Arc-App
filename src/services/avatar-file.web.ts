import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Web-Vorschau: kein Dateisystem – das verkleinerte Bild bleibt als Data-URL (ca. 50 KB). */
export async function pickAvatar(_source: 'camera' | 'library'): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const ref = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 512, height: null }).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : saved.uri;
}

export async function avatarBytes(name: string): Promise<ArrayBuffer> {
  return (await fetch(name)).arrayBuffer();
}
