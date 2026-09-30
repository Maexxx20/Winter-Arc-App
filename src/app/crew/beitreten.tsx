import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeCode } from '@/lib/crew';
import { haptic } from '@/lib/haptics';
import { joinCrew } from '@/services/crews';
import { useSession } from '@/services/supabase';
import { updateProfile, useAppState } from '@/store/store';

/** Einstieg über Einladungslink: nordwand://crew/beitreten?code=ABC123 */
export default function JoinCrewScreen() {
  const theme = useTheme();
  const session = useSession();
  const { settings } = useAppState();
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(normalizeCode(typeof raw === 'string' ? raw : ''));
  const [name, setName] = useState(settings.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      if (name.trim() !== settings.name) updateProfile({ name: name.trim() });
      const crew = await joinCrew(code);
      haptic.success();
      router.replace({ pathname: '/crew/[id]', params: { id: crew.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen topInset={Platform.OS !== 'ios'}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label">Einladung</T>
          <T variant="title">Crew beitreten</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {!session ? (
        <>
          <T color="textSecondary">Um einer Crew beizutreten, brauchst du ein Konto. Danach kommst du hierher zurück.</T>
          <Button title="Anmelden" onPress={() => router.push('/konto')} />
        </>
      ) : (
        <>
          <TextField
            label="Einladungscode"
            value={code}
            onChangeText={(v) => setCode(normalizeCode(v))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ABC123"
            style={styles.code}
          />
          <TextField label="So sehen dich die anderen" value={name} onChangeText={setName} maxLength={40} placeholder="Dein Name" />
          <Button title="Beitreten" onPress={join} loading={busy} disabled={code.length !== 6 || !name.trim()} />
        </>
      )}

      {error ? (
        <T variant="caption" color="danger">
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
});
