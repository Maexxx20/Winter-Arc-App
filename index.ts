/**
 * Einstiegspunkt: Expo Router plus (nur Android) die Hintergrund-Aufgabe fürs Homescreen-Widget.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./src/services/widget.android').registerAndroidWidget();
}
