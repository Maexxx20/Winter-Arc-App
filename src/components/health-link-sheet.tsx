import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suggestHealthLink } from '@/lib/health';
import { t } from '@/i18n';
import type { HealthLink, Rule, TimeOfDay } from '@/lib/types';

import { HealthLinkPicker } from './health-link-picker';
import { CloseIcon } from './icons';
import { Button } from './ui/button';
import { TimeRow } from './ui/time-row';
import { T } from './ui/text';

/** Verknüpfung einer bestehenden Regel ändern – ohne Vertragsänderung. */
export function HealthLinkSheet({
  rule,
  onClose,
  onSave,
}: {
  rule: Rule | null;
  onClose: () => void;
  onSave: (link: HealthLink | null, reminder: TimeOfDay | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<HealthLink | undefined>(undefined);
  const [reminder, setReminder] = useState<TimeOfDay | null>(null);

  useEffect(() => {
    if (rule) {
      setLink(rule.health ?? suggestHealthLink(rule) ?? undefined);
      setReminder(rule.reminder ?? null);
    }
  }, [rule]);

  return (
    <Modal visible={!!rule} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Spacing.four : insets.top + Spacing.two }]}>
          <View style={styles.flex}>
            <T variant="label">{t('ruleReminder.sheetLabel')}</T>
            <T variant="heading" numberOfLines={1}>{rule ? `${rule.icon} ${rule.title}` : ''}</T>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
            <CloseIcon color={theme.text} size={16} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <T variant="label">{t('ruleReminder.section')}</T>
          <TimeRow
            label={t('ruleReminder.label')}
            hint={t('ruleReminder.hint')}
            value={reminder}
            fallback={18 * 60}
            onChange={setReminder}
          />
          <T variant="label">{t('contract.sheet.auto')}</T>
          <HealthLinkPicker value={link} onChange={setLink} />
          <T variant="caption" color="textTertiary">
            {t('contract.sheet.note')}
          </T>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four, borderTopColor: theme.border }]}>
          <Button title={t('common.save')} onPress={() => onSave(link ?? null, reminder)} />
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
