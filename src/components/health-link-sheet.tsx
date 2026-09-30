import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestHealthLink } from '@/lib/health';
import type { HealthLink, Rule } from '@/lib/types';

import { HealthLinkPicker } from './health-link-picker';
import { CloseIcon } from './icons';
import { Button } from './ui/button';
import { T } from './ui/text';

/** Verknüpfung einer bestehenden Regel ändern – ohne Vertragsänderung. */
export function HealthLinkSheet({
  rule,
  onClose,
  onSave,
}: {
  rule: Rule | null;
  onClose: () => void;
  onSave: (link: HealthLink | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<HealthLink | undefined>(undefined);

  useEffect(() => {
    if (rule) setLink(rule.health ?? suggestHealthLink(rule) ?? undefined);
  }, [rule]);

  return (
    <Modal visible={!!rule} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Spacing.four : insets.top + Spacing.two }]}>
          <View style={styles.flex}>
            <T variant="label">Automatisch abhaken</T>
            <T variant="heading" numberOfLines={1}>{rule ? `${rule.icon} ${rule.title}` : ''}</T>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
            <CloseIcon color={theme.text} size={16} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <HealthLinkPicker value={link} onChange={setLink} />
          <T variant="caption" color="textTertiary">
            Das ist keine Vertragsänderung – die Regel bleibt dieselbe, sie wird nur automatisch abgehakt.
          </T>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four, borderTopColor: theme.border }]}>
          <Button title="Speichern" onPress={() => onSave(link ?? null)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.five, paddingBottom: Spacing.three },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.five, gap: Spacing.five },
  footer: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
