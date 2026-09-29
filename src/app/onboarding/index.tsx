import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ArcGauge } from '@/components/arc-gauge';
import { ShieldIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { selectActiveArc, useAppState } from '@/store/store';

export default function Welcome() {
  const theme = useTheme();
  const state = useAppState();
  const session = useSession();
  // Nach dem Anmelden auf einem neuen Gerät kommt der Arc vom Server → direkt weiter.
  if (selectActiveArc(state)) return <Redirect href="/" />;

  const principles = [
    {
      icon: <T style={styles.pIcon}>✍️</T>,
      title: 'Wenige, klare Regeln',
      text: '3–5 tägliche Regeln, die du auch an einem schlechten Tag schaffst.',
    },
    {
      icon: <ShieldIcon color={theme.shield} size={22} filled />,
      title: 'Nie zweimal verpassen',
      text: 'Einen verpassten Tag pro Woche fängt dein Schild auf. Erst zwei in Folge brechen den Streak.',
    },
    {
      icon: <T style={styles.pIcon}>🤝</T>,
      title: 'Du gibst dir dein Wort',
      text: 'Du unterschreibst deinen Vertrag. Danach darfst du ihn nur noch dreimal ändern.',
    },
  ];

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title="Meinen Arc erstellen" onPress={() => router.push('/onboarding/create')} />
          {supabaseConfigured && !session && (
            <Button title="Ich habe schon ein Konto" variant="ghost" small onPress={() => router.push('/konto')} />
          )}
        </View>
      }>
      <View style={styles.hero}>
        <T variant="label" color="accent" style={styles.brand}>
          Nordwand
        </T>
        <ArcGauge progress={0.62} today={1} dayNumber={92} totalDays={92} label="Tage" sub="1. Okt – 31. Dez" size={220} />
        <T variant="display" center>
          Dein Winter Arc.
        </T>
        <T variant="body" color="textSecondary" center style={styles.lead}>
          Während alle anderen in den Winterschlaf gehen, baust du Gewohnheiten auf – und startest als
          bessere Version ins neue Jahr.
        </T>
      </View>

      <View style={styles.list}>
        {principles.map((p) => (
          <View key={p.title} style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.surfaceMuted }]}>{p.icon}</View>
            <View style={styles.itemText}>
              <T variant="bodyStrong">{p.title}</T>
              <T variant="caption">{p.text}</T>
            </View>
          </View>
        ))}
      </View>

      <T variant="caption" color="textTertiary" center>
        Neue Gewohnheiten brauchen im Schnitt rund 66 Tage, bis sie automatisch laufen. Ein Arc gibt dir genau diese Zeit.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  brand: { letterSpacing: 4, fontSize: 13 },
  lead: { maxWidth: 380 },
  list: { gap: Spacing.three, marginTop: Spacing.four },
  item: {
    flexDirection: 'row',
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  iconWrap: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pIcon: { fontSize: 22, lineHeight: 28 },
  itemText: { flex: 1, gap: 2 },
  footer: { gap: Spacing.one },
});
