import * as ImagePicker from 'expo-image-picker';

/** Web-Vorschau: Bild als Data-URL behalten (kein Dateisystem). */
export function photoUri(name: string): string {
  return name;
}

export async function pickPhoto(_source: 'camera' | 'library'): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: false });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}

export function deletePhoto(_name: string) {}

export function photoExists(_name: string): boolean {
  return true;
}

export async function photoBytes(name: string): Promise<ArrayBuffer> {
  return (await fetch(name)).arrayBuffer();
}
