import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { healthProviderName, type HealthSupport, healthSupport, requestHealthAccess } from '@/services/health-source';
import { syncHealthNow } from '@/services/health-sync';
import { connectStrava, disconnectStrava, stravaAvailableHere } from '@/services/strava';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { selectActiveArc, updateSettings, useAppState } from '@/store/store';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { T } from './ui/text';

const SUPPORT_TEXT: Record<Exclude<HealthSupport, 'available'>, string> = {
  'expo-go': 'Geht erst in der richtigen App (Development-Build, TestFlight oder Store) – nicht in Expo Go.',
  unsupported: 'Auf diesem Gerät nicht verfügbar.',
  'needs-app': 'Installiere bzw. aktualisiere zuerst «Health Connect» aus dem Play Store.',
};

/** Verbindungen zu Apple Health / Health Connect und Strava. */
export function ConnectionsCard() {
  const theme = useTheme();
  const state = useAppState();
  const session = useSession();
  const [support, setSupport] = useState<HealthSupport | null>(null);
  const [busy, setBusy] = useState<'health' | 'strava' | null>(null);
  const arc = selectActiveArc(state);
  const linked = arc?.rules.filter((r) => r.health && !r.removedOn).length ?? 0;
  const { healthEnabled, stravaAthlete } = state.settings;

  useEffect(() => {
    healthSupport().then(setSupport);
  }, []);

  const connectHealth = async () => {
    setBusy('health');
    const ok = await requestHealthAccess();
    setBusy(null);
    if (!ok) {
      await confirm(`${healthProviderName} nicht verbunden`, 'Erlaube Nordwand in den Einstellungen deines Handys, Health-Daten zu lesen.', 'OK');
      return;
    }
    updateSettings({ healthEnabled: true });
    const n = await syncHealthNow(true);
    if (n) await confirm('Verbunden', `${n} ${n === 1 ? 'Wert wurde' : 'Werte wurden'} gleich übernommen.`, 'OK');
  };

  const toggleStrava = async () => {
    setBusy('strava');
    const err = stravaAthlete ? await disconnectStrava() : await connectStrava();
    setBusy(null);
    if (err) await confirm('Strava', err, 'OK');
    else if (!stravaAthlete) syncHealthNow(true);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.item}>
        <T variant="bodyStrong">{healthProviderName}</T>
        <T variant="caption">
          {support && support !== 'available'
            ? SUPPORT_TEXT[support]
            : healthEnabled
              ? `Verbunden · liest Schritte, Training, Schlaf, Wasser und Achtsamkeit.`
              : 'Schritte, Training, Schlaf, Wasser und Achtsamkeit lesen – nur lesen, nie schreiben.'}
        </T>
        {support === 'available' ? (
          healthEnabled ? (
            <Button title="Nicht mehr verwenden" variant="ghost" small onPress={() => updateSettings({ healthEnabled: false })} />
          ) : (
            <Button title={`Mit ${healthProviderName} verbinden`} variant="secondary" small loading={busy === 'health'} onPress={connectHealth} />
          )
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.item}>
        <T variant="bodyStrong">Strava</T>
        <T variant="caption">
          {stravaAthlete
            ? `Verbunden als ${stravaAthlete} · Aktivitäten zählen als Training.`
            : !supabaseConfigured || !session
              ? 'Für Strava brauchst du ein Konto (Profil → Anmelden).'
              : (stravaAvailableHere() ?? 'Aktivitäten aus Strava zählen als Training.')}
        </T>
        {supabaseConfigured && session && (stravaAthlete || !stravaAvailableHere()) ? (
          <Button
            title={stravaAthlete ? 'Strava trennen' : 'Mit Strava verbinden'}
            variant={stravaAthlete ? 'ghost' : 'secondary'}
            small
            loading={busy === 'strava'}
            onPress={toggleStrava}
          />
        ) : null}
      </View>

      <T variant="caption" color="textTertiary">
        Garmin, Polar, Suunto, Coros, Oura oder Whoop: In deren App die Synchronisierung mit {healthProviderName} einschalten – dann
        kommen die Werte automatisch hier an. {linked ? `${linked} ${linked === 1 ? 'Regel ist' : 'Regeln sind'} verknüpft.` : 'Tippe oben auf eine Regel, um sie zu verknüpfen.'}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.four },
  item: { gap: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth },
});
