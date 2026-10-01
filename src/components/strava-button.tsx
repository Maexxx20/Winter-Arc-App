import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

/**
 * «Connect with Strava» im Stil der Strava-Richtlinien (Orange #FC5200, weisse Schrift, 48 pt hoch).
 * Vor der Prüfung durch Strava durch die offiziellen Grafiken ersetzen:
 * https://developers.strava.com/downloads/1.1-Connect-with-Strava-Buttons.zip (siehe docs/SUPABASE.md, 2d).
 */
export const STRAVA_ORANGE = '#FC5200';

export function StravaConnectButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Connect with Strava"
      style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.85 : 1 }]}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.text}>Connect with Strava</Text>}
    </Pressable>
  );
}

/** Pflicht-Hinweis neben Daten aus Strava */
export function PoweredByStrava() {
  return <Text style={styles.powered}>Powered by Strava</Text>;
}

const styles = StyleSheet.create({
  button: { height: 48, borderRadius: 4, backgroundColor: STRAVA_ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' },
  text: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  powered: { color: STRAVA_ORANGE, fontSize: 12, fontWeight: '700' },
});
