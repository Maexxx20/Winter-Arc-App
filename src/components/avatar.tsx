import { StyleSheet, View } from 'react-native';

import { T } from './ui/text';

const PALETTE = ['#2657D9', '#0E8A6A', '#B45309', '#9333EA', '#C2362B', '#0369A1', '#4D7C0F', '#BE185D'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Runder Avatar mit Initiale – Farbe stabil pro Person. */
export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const color = PALETTE[hash(id) % PALETTE.length];
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <T style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{initial}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
});
