import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_LABELS, ICON_CHOICES, type RuleTemplate } from '@/lib/templates';
import type { RuleCategory } from '@/lib/types';

import { CloseIcon } from './icons';
import { Button } from './ui/button';
import { Chip, Segmented, Stepper, TextField } from './ui/controls';
import { T } from './ui/text';

type Props = {
  visible: boolean;
  initial?: RuleTemplate | null;
  onClose: () => void;
  onSave: (rule: RuleTemplate) => void;
};

const EMPTY: RuleTemplate = {
  title: '',
  icon: '⭐',
  category: 'discipline',
  frequency: { kind: 'daily' },
  measure: { kind: 'check' },
};

export function RuleEditor({ visible, initial, onClose, onSave }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<RuleTemplate>(initial ?? EMPTY);
  const [targetText, setTargetText] = useState('');

  useEffect(() => {
    if (visible) {
      const d = initial ?? EMPTY;
      setDraft(d);
      setTargetText(d.measure.kind === 'amount' ? String(d.measure.target).replace('.', ',') : '');
    }
  }, [visible, initial]);

  const target = parseFloat(targetText.replace(',', '.'));
  const amountValid = draft.measure.kind !== 'amount' || (target > 0 && draft.measure.unit.trim().length > 0);
  const valid = draft.title.trim().length > 0 && amountValid;

  const save = () => {
    if (!valid) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      measure: draft.measure.kind === 'amount' ? { kind: 'amount', target, unit: draft.measure.unit.trim() } : draft.measure,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? Spacing.four : insets.top + Spacing.two }]}>
          <T variant="heading">{initial ? 'Regel anpassen' : 'Eigene Regel'}</T>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schliessen" style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
            <CloseIcon color={theme.text} size={16} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextField
            label="Regel"
            placeholder="z. B. 30 Min. Spanisch"
            value={draft.title}
            onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
            maxLength={40}
            autoFocus={!initial}
          />

          <View style={styles.group}>
            <T variant="label">Symbol</T>
            <View style={styles.icons}>
              {ICON_CHOICES.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setDraft((d) => ({ ...d, icon }))}
                  style={[
                    styles.iconCell,
                    { backgroundColor: draft.icon === icon ? theme.accentSoft : theme.surface, borderColor: draft.icon === icon ? theme.accent : theme.border },
                  ]}>
                  <T style={styles.iconText}>{icon}</T>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <T variant="label">Bereich</T>
            <View style={styles.chips}>
              {(Object.keys(CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                <Chip key={c} label={CATEGORY_LABELS[c]} selected={draft.category === c} onPress={() => setDraft((d) => ({ ...d, category: c }))} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <T variant="label">Wie oft?</T>
            <Segmented
              value={draft.frequency.kind}
              onChange={(k) =>
                setDraft((d) => ({ ...d, frequency: k === 'daily' ? { kind: 'daily' } : { kind: 'weekly', times: 3 } }))
              }
              options={[
                { value: 'daily', label: 'Täglich' },
                { value: 'weekly', label: 'Pro Woche' },
              ]}
            />
            {draft.frequency.kind === 'weekly' && (
              <View style={styles.inline}>
                <T variant="body" color="textSecondary">
                  Ziel pro Woche
                </T>
                <Stepper
                  value={draft.frequency.times}
                  min={1}
                  max={6}
                  format={(v) => `${v}×`}
                  onChange={(times) => setDraft((d) => ({ ...d, frequency: { kind: 'weekly', times } }))}
                />
              </View>
            )}
          </View>

          <View style={styles.group}>
            <T variant="label">Wie messen?</T>
            <Segmented
              value={draft.measure.kind}
              onChange={(k) => {
                if (k === 'amount') {
                  setTargetText('10');
                  setDraft((d) => ({ ...d, measure: { kind: 'amount', target: 10, unit: 'Min' } }));
                } else setDraft((d) => ({ ...d, measure: { kind: 'check' } }));
              }}
              options={[
                { value: 'check', label: 'Abhaken' },
                { value: 'amount', label: 'Menge' },
              ]}
            />
            {draft.measure.kind === 'amount' && (
              <View style={styles.amountRow}>
                <View style={styles.flex}>
                  <TextField label="Ziel" keyboardType="decimal-pad" value={targetText} onChangeText={setTargetText} placeholder="10" />
                </View>
                <View style={styles.flex}>
                  <TextField
                    label="Einheit"
                    value={draft.measure.unit}
                    maxLength={12}
                    placeholder="Min, Seiten …"
                    onChangeText={(unit) =>
                      setDraft((d) => (d.measure.kind === 'amount' ? { ...d, measure: { ...d.measure, unit } } : d))
                    }
                  />
                </View>
              </View>
            )}
          </View>

          <T variant="caption" color="textTertiary">
            Tipp: Formuliere Regeln so, dass du sie auch an einem schlechten Tag schaffst. Lieber 10 Seiten jeden Tag als 50 ab und zu.
          </T>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four, borderTopColor: theme.border }]}>
          <Button title={initial ? 'Übernehmen' : 'Regel hinzufügen'} onPress={save} disabled={!valid} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.three,
  },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.five, gap: Spacing.six, paddingBottom: Spacing.ten },
  group: { gap: Spacing.three },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 44, height: 44, borderRadius: Radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
  footer: { paddingHorizontal: Spacing.five, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
