import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HoldToSign } from '@/components/hold-to-sign';
import { ChevronIcon, CloseIcon, PlusIcon } from '@/components/icons';
import { RuleEditor } from '@/components/rule-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { addDays, diffDays, formatShort, type ISODate, parseISO } from '@/lib/date';
import {
  CATEGORY_LABELS,
  describeRule,
  HARD_MAX_RULES,
  RECOMMENDED_MAX_RULES,
  RULE_TEMPLATES,
  type RuleTemplate,
} from '@/lib/templates';
import type { RuleCategory } from '@/lib/types';
import { createArc, getState } from '@/store/store';

const STEPS = ['Zeitraum', 'Regeln', 'Warum', 'Vertrag'] as const;

type StartChoice = 'oct1' | 'today' | 'tomorrow';
type LengthChoice = 'newyear' | 66 | 90;

function resolveStart(choice: StartChoice, today: ISODate): ISODate {
  if (choice === 'today') return today;
  if (choice === 'tomorrow') return addDays(today, 1);
  return `${parseISO(today).getFullYear()}-10-01`;
}

function resolveEnd(start: ISODate, len: LengthChoice): ISODate {
  if (len === 'newyear') return `${parseISO(start).getFullYear()}-12-31`;
  return addDays(start, len - 1);
}

export default function CreateArc() {
  const theme = useTheme();
  const today = useToday();
  const year = parseISO(today).getFullYear();
  const oct1 = `${year}-10-01`;
  const oct1InFuture = oct1 > today;

  const [step, setStep] = useState(0);
  const [startChoice, setStartChoice] = useState<StartChoice>(oct1InFuture ? 'oct1' : 'today');
  const [lengthChoice, setLengthChoice] = useState<LengthChoice>('newyear');
  const [rules, setRules] = useState<RuleTemplate[]>([]);
  const [editor, setEditor] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const [title, setTitle] = useState(`Winter Arc ${year}`);
  const [why, setWhy] = useState('');
  const [name, setName] = useState(getState().settings.name);

  const startDate = resolveStart(startChoice, today);
  const newYearDays = diffDays(startDate, `${parseISO(startDate).getFullYear()}-12-31`) + 1;
  const effectiveLength: LengthChoice = lengthChoice === 'newyear' && newYearDays < 21 ? 90 : lengthChoice;
  const endDate = resolveEnd(startDate, effectiveLength);
  const totalDays = diffDays(startDate, endDate) + 1;

  const dailyCount = rules.filter((r) => r.frequency.kind === 'daily').length;
  const canContinue = [true, dailyCount > 0, true, name.trim().length > 1][step];

  const grouped = useMemo(() => {
    const m = new Map<RuleCategory, RuleTemplate[]>();
    for (const t of RULE_TEMPLATES) m.set(t.category, [...(m.get(t.category) ?? []), t]);
    return [...m.entries()];
  }, []);

  const isSelected = (t: RuleTemplate) => rules.some((r) => r.title === t.title);
  const toggleTemplate = (t: RuleTemplate) =>
    setRules((rs) => (isSelected(t) ? rs.filter((r) => r.title !== t.title) : rs.length >= HARD_MAX_RULES ? rs : [...rs, t]));

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const next = () => setStep(Math.min(STEPS.length - 1, step + 1));

  const sign = () => {
    createArc({ title, startDate, endDate, why, rules, signatureName: name });
    setTimeout(() => router.replace('/'), 500);
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={back} hitSlop={12} accessibilityLabel="Zurück" style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
        {step === 0 ? <CloseIcon color={theme.text} size={16} /> : <ChevronIcon dir="left" color={theme.text} size={18} />}
      </Pressable>
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, { backgroundColor: i <= step ? theme.accent : theme.border, width: i === step ? 22 : 8 }]} />
        ))}
      </View>
      <View style={styles.round} />
    </View>
  );

  const footer =
    step < 3 ? (
      <Button title="Weiter" onPress={next} disabled={!canContinue} />
    ) : (
      <HoldToSign onSigned={sign} disabled={!canContinue} />
    );

  return (
    <Screen footer={footer}>
      {header}

      {step === 0 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">Schritt 1 · Zeitraum</T>
            <T variant="title">Wann startest du?</T>
            <T color="textSecondary">
              Der klassische Winter Arc läuft vom 1. Oktober bis Silvester. Du kannst aber jederzeit einsteigen.
            </T>
          </View>

          <SectionTitle>Start</SectionTitle>
          <View style={styles.chips}>
            {oct1InFuture && <Chip label={`1. Oktober`} selected={startChoice === 'oct1'} onPress={() => setStartChoice('oct1')} />}
            <Chip label="Heute" selected={startChoice === 'today'} onPress={() => setStartChoice('today')} />
            <Chip label="Morgen" selected={startChoice === 'tomorrow'} onPress={() => setStartChoice('tomorrow')} />
          </View>

          <SectionTitle>Dauer</SectionTitle>
          <View style={styles.chips}>
            {newYearDays >= 21 && (
              <Chip label={`Bis Silvester · ${newYearDays} Tage`} selected={effectiveLength === 'newyear'} onPress={() => setLengthChoice('newyear')} />
            )}
            <Chip label="66 Tage" selected={effectiveLength === 66} onPress={() => setLengthChoice(66)} />
            <Chip label="90 Tage" selected={effectiveLength === 90} onPress={() => setLengthChoice(90)} />
          </View>

          <Card tone="accentSoft" bordered={false} style={styles.summary}>
            <T variant="label" color="accent">Dein Arc</T>
            <T variant="title">
              {formatShort(startDate)} – {formatShort(endDate, true)}
            </T>
            <T color="textSecondary">{totalDays} Tage</T>
          </Card>
        </>
      )}

      {step === 1 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">Schritt 2 · Regeln</T>
            <T variant="title">Deine Regeln</T>
            <T color="textSecondary">
              Wähle 3–{RECOMMENDED_MAX_RULES} Regeln. Weniger ist mehr: Wer alles auf einmal will, gibt meist in der ersten Woche auf.
            </T>
          </View>

          <SectionTitle
            action={
              <T variant="caption" color={rules.length > RECOMMENDED_MAX_RULES ? 'warning' : 'textSecondary'}>
                {rules.length}/{RECOMMENDED_MAX_RULES}
                {rules.length > RECOMMENDED_MAX_RULES ? ' · ambitioniert' : ''}
              </T>
            }>
            Ausgewählt
          </SectionTitle>

          {rules.length === 0 ? (
            <Card tone="surfaceMuted" bordered={false}>
              <T variant="caption" center>
                Noch keine Regel. Tippe unten auf eine Vorlage oder erstelle deine eigene.
              </T>
            </Card>
          ) : (
            <View style={styles.selected}>
              {rules.map((r, i) => (
                <Pressable
                  key={`${r.title}-${i}`}
                  onPress={() => setEditor({ open: true, index: i })}
                  style={[styles.selRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <T style={styles.selIcon}>{r.icon}</T>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{r.title}</T>
                    <T variant="caption">{describeRule(r)}</T>
                  </View>
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel={`${r.title} entfernen`}
                    onPress={() => setRules((rs) => rs.filter((_, j) => j !== i))}
                    style={[styles.round, styles.smallRound, { backgroundColor: theme.surfaceMuted }]}>
                    <CloseIcon color={theme.textSecondary} size={14} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
          {rules.length > 0 && dailyCount === 0 && (
            <T variant="caption" color="warning">
              Mindestens eine Regel muss täglich sein – sie bestimmt deinen Streak.
            </T>
          )}

          <Button
            title="Eigene Regel"
            variant="secondary"
            icon={<PlusIcon color={theme.text} size={16} />}
            disabled={rules.length >= HARD_MAX_RULES}
            onPress={() => setEditor({ open: true, index: null })}
          />

          {grouped.map(([cat, templates]) => (
            <View key={cat} style={styles.group}>
              <SectionTitle>{CATEGORY_LABELS[cat]}</SectionTitle>
              <View style={styles.chips}>
                {templates.map((t) => (
                  <Chip
                    key={t.title}
                    icon={t.icon}
                    label={t.title}
                    selected={isSelected(t)}
                    disabled={!isSelected(t) && rules.length >= HARD_MAX_RULES}
                    onPress={() => toggleTemplate(t)}
                  />
                ))}
              </View>
            </View>
          ))}

          <RuleEditor
            visible={editor.open}
            initial={editor.index !== null ? rules[editor.index] : null}
            onClose={() => setEditor({ open: false, index: null })}
            onSave={(rule) => {
              setRules((rs) => (editor.index !== null ? rs.map((r, i) => (i === editor.index ? rule : r)) : [...rs, rule]));
              setEditor({ open: false, index: null });
            }}
          />
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">Schritt 3 · Warum</T>
            <T variant="title">Wofür machst du das?</T>
            <T color="textSecondary">
              An Tag 23, wenn es dunkel und kalt ist, zählt nicht Motivation, sondern dein Grund. Schreib ihn auf.
            </T>
          </View>
          <TextField label="Name deines Arcs" value={title} onChangeText={setTitle} maxLength={40} />
          <TextField
            label="Mein Warum"
            value={why}
            onChangeText={setWhy}
            multiline
            maxLength={400}
            placeholder="Am 1. Januar will ich … Ich mache das, weil …"
          />
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">Schritt 4 · Vertrag</T>
            <T variant="title">Unterschreib ihn.</T>
          </View>

          <TextField label="Dein Name" value={name} onChangeText={setName} maxLength={40} placeholder="Vor- oder Spitzname" />

          <Card style={styles.contract}>
            <T variant="label" center>Vertrag mit mir selbst</T>
            <T variant="heading" center style={styles.contractTitle}>{title || 'Winter Arc'}</T>
            <T color="textSecondary">
              Ich, <T variant="bodyStrong">{name.trim() || '______'}</T>, verpflichte mich, vom {formatShort(startDate)} bis{' '}
              {formatShort(endDate, true)} ({totalDays} Tage) folgende Regeln einzuhalten:
            </T>
            <View style={styles.contractRules}>
              {rules.map((r, i) => (
                <View key={i} style={styles.contractRule}>
                  <T style={styles.selIcon}>{r.icon}</T>
                  <T variant="bodyStrong" style={styles.flex}>{r.title}</T>
                  <T variant="caption">{describeRule(r)}</T>
                </View>
              ))}
            </View>
            {why.trim() ? (
              <T color="textSecondary" style={styles.why}>
                Weil: «{why.trim()}»
              </T>
            ) : null}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <T variant="caption">
              Ein verpasster Tag ist kein Scheitern. Ich verpasse nie zwei Tage hintereinander. Ich darf diesen Vertrag
              höchstens dreimal ändern.
            </T>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  smallRound: { width: 28, height: 28, borderRadius: 14 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  titleBlock: { gap: Spacing.two, marginTop: Spacing.two, marginBottom: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { gap: 4, marginTop: Spacing.four, borderRadius: Radius.lg },
  selected: { gap: Spacing.two },
  selRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selIcon: { fontSize: 20, lineHeight: 26 },
  flex: { flex: 1 },
  group: { gap: Spacing.two },
  contract: { gap: Spacing.three, padding: Spacing.five },
  contractTitle: { marginBottom: Spacing.two },
  contractRules: { gap: Spacing.two, marginVertical: Spacing.two },
  contractRule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  why: { fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth },
});
