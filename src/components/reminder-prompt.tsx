import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { enableReminders } from '@/services/notifications';
import { updateReminders, useAppState } from '@/store/store';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { T } from './ui/text';

/** Einmalige Frage nach Erinnerungen – erscheint, bis man sich entschieden hat. */
export function ReminderPrompt() {
  const { settings } = useAppState();
  if (settings.reminders.enabled !== null) return null;
  return (
    <Card style={styles.card}>
      <T variant="bodyStrong">🔔 Erinnerungen einschalten?</T>
      <T variant="caption">
        Morgens ein kurzer Anstoss, abends ein Check-in – aber nur, wenn noch etwas offen ist. Zeiten kannst du im Tab
        «Vertrag» ändern.
      </T>
      <View style={styles.row}>
        <Button title="Nein danke" variant="secondary" small style={styles.flex} onPress={() => updateReminders({ enabled: false })} />
        <Button title="Einschalten" small style={styles.flex} onPress={() => enableReminders()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  flex: { flex: 1 },
});
