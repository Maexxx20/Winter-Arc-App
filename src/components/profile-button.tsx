import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { MyAvatar } from './avatar';

/** Profilbild oben rechts – öffnet das eigene Profil. */
export function ProfileButton() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/profil')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('contract.profile.openA11y')}
      style={({ pressed }) => [styles.wrap, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <View>
        <MyAvatar size={38} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 2, borderRadius: 22, padding: 1, alignSelf: 'flex-start', marginTop: 2 },
});
