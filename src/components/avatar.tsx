import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useAvatarUrl } from '@/services/profile';
import { photoUri } from '@/services/photos';
import { useAppState } from '@/store/store';

import { T } from './ui/text';

const PALETTE = ['#2657D9', '#0E8A6A', '#B45309', '#9333EA', '#C2362B', '#0369A1', '#4D7C0F', '#BE185D'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface Props {
  id: string;
  name: string;
  size?: number;
  /** Bild-URL; ohne Bild erscheint die Initiale. */
  uri?: string | null;
  /** Stabiler Schlüssel für den Bild-Cache (z. B. Pfad auf dem Server). */
  cacheKey?: string | null;
}

/** Runder Avatar: Profilbild oder Initiale in einer pro Person stabilen Farbe. */
export function Avatar({ id, name, size = 40, uri, cacheKey }: Props) {
  const color = PALETTE[hash(id) % PALETTE.length];
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.avatar, box, { backgroundColor: color }]}>
      <T style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{initial}</T>
      {uri ? (
        <Image
          source={cacheKey ? { uri, cacheKey } : { uri }}
          style={[StyleSheet.absoluteFill, box]}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/** Avatar eines Crew-Mitglieds anhand des Bildpfads auf dem Server. */
export function RemoteAvatar({ path, ...rest }: Omit<Props, 'uri' | 'cacheKey'> & { path: string | null | undefined }) {
  const url = useAvatarUrl(path);
  return <Avatar {...rest} uri={url} cacheKey={path} />;
}

/** Eigenes Profilbild: lokale Datei, sonst Bild vom Server. */
export function MyAvatar({ size = 40 }: { size?: number }) {
  const { settings } = useAppState();
  const remoteUrl = useAvatarUrl(settings.avatar.local ? null : settings.avatar.remote);
  const uri = settings.avatar.local ? photoUri(settings.avatar.local) : remoteUrl;
  return (
    <Avatar
      id={settings.name || 'me'}
      name={settings.name || '?'}
      size={size}
      uri={uri}
      cacheKey={settings.avatar.local ?? settings.avatar.remote}
    />
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { color: '#fff', fontWeight: '700' },
});
