import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ArcGauge } from '@/components/arc-gauge';
import { ShieldIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { formatShort } from '@/lib/date';
import { seasonOptions, seasonPitch } from '@/lib/seasons';
import { t } from '@/i18n';
import { supabaseConfigured, useSession } from '@/services/supabase';
import { selectActiveArc, useAppState } from '@/store/store';

export default function Welcome() {
  const theme = useTheme();
  const state = useAppState();
  const session = useSession();
  const today = useToday();
  // Nach dem Anmelden auf einem neuen Gerät kommt der Arc vom Server → direkt weiter.
  if (selectActiveArc(state)) return <Redirect href="/" />;
  const season = seasonOptions(today)[0];

  const principles = [
    {
      icon: <T style={styles.pIcon}>✍️</T>,
      key: 'rules',
      title: t('today.onboarding.p1Title'),
      text: t('today.onboarding.p1Text'),
    },
    {
      icon: <ShieldIcon color={theme.shield} size={22} filled />,
      key: 'shield',
      title: t('today.onboarding.p2Title'),
      text: t('today.onboarding.p2Text'),
    },
    {
      icon: <T style={styles.pIcon}>🤝</T>,
      key: 'word',
      title: t('today.onboarding.p3Title'),
      text: t('today.onboarding.p3Text'),
    },
  ];

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title={t('today.onboarding.createArc')} onPress={() => router.push('/onboarding/create')} />
          {supabaseConfigured && !session && (
            <Button title={t('today.onboarding.haveAccount')} variant="ghost" small onPress={() => router.push('/konto')} />
          )}
        </View>
      }>
      <View style={styles.hero}>
        <T variant="label" color="accent" style={styles.brand}>
          Nordwand
        </T>
        <ArcGauge
          progress={0.62}
          today={1}
          dayNumber={season.totalDays}
          totalDays={season.totalDays}
          label={t('today.onboarding.gaugeLabel')}
          sub={`${formatShort(season.startDate)} – ${formatShort(season.endDate)}`}
          size={220}
        />
        <T variant="display" center>
          {t('today.onboarding.yourSeason', { season: season.season.title })}
        </T>
        <T variant="body" color="textSecondary" center style={styles.lead}>
          {season.season.id === 'winter'
            ? t('today.onboarding.winterLead')
            : t('today.onboarding.seasonLead', { pitch: seasonPitch(season.season) })}
        </T>
      </View>

      <View style={styles.list}>
        {principles.map((p) => (
          <View key={p.key} style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.surfaceMuted }]}>{p.icon}</View>
            <View style={styles.itemText}>
              <T variant="bodyStrong">{p.title}</T>
              <T variant="caption">{p.text}</T>
            </View>
          </View>
        ))}
      </View>

      <T variant="caption" color="textTertiary" center>
        {t('today.onboarding.habitNote')}
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
