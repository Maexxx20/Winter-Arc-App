import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HoldToSign } from '@/components/hold-to-sign';
import { ChevronIcon, CloseIcon, PlusIcon } from '@/components/icons';
import { RuleEditor } from '@/components/rule-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip, SectionTitle, Stepper, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { addDays, diffDays, formatShort, type ISODate } from '@/lib/date';
import { customArcTitle, seasonOptions } from '@/lib/seasons';
import {
  CATEGORY_LABELS,
  describeRule,
  HARD_MAX_RULES,
  RECOMMENDED_MAX_RULES,
  RULE_TEMPLATES,
  type RuleTemplate,
} from '@/lib/templates';
import type { Arc, RuleCategory } from '@/lib/types';
import { t } from '@/i18n';
import { uid } from '@/lib/arc';
import { toCrewArcRules } from '@/lib/crew-arc';
import { cachedCrew, publishCrewArc, signCrewArc } from '@/services/crews';
import { createArc, getState, useAppState } from '@/store/store';

const STEPS = ['Zeitraum', 'Regeln', 'Warum', 'Vertrag'] as const;

type Plan = { kind: 'season'; title: string | null } | { kind: 'custom' };
type StartChoice = 'today' | 'tomorrow';
const LENGTHS = [21, 30, 66, 90] as const;

/** Regeln eines früheren Arcs als Vorlagen (aktuelle Regeln, ohne entfernte). */
function templatesFromArc(arc: Arc): RuleTemplate[] {
  return arc.rules
    .filter((r) => !r.removedOn)
    .map(({ title, icon, category, frequency, measure, health }) => ({ title, icon, category, frequency, measure, health }));
}

export default function CreateArc() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  // Aus einem früheren Arc: Regeln und «Warum» übernehmen.
  // `crew`: Besitzer legt einen Crew-Arc für diese Crew an.
  const { from, crew: crewId } = useLocalSearchParams<{ from?: string; crew?: string }>();
  const source = from ? state.arcs.find((a) => a.id === from) : undefined;
  const crewName = crewId ? (cachedCrew(crewId)?.crew.name ?? '') : null;
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signKey, setSignKey] = useState(0);

  const options = useMemo(() => seasonOptions(today), [today]);
  const [plan, setPlan] = useState<Plan>({ kind: 'season', title: null });
  const [startChoice, setStartChoice] = useState<StartChoice>('today');
  const [length, setLength] = useState(66);

  const [step, setStep] = useState(0);
  const [rules, setRules] = useState<RuleTemplate[]>(() => (source ? templatesFromArc(source) : []));
  const [editor, setEditor] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const [why, setWhy] = useState(source?.why ?? '');
  const [name, setName] = useState(getState().settings.name);

  // Nach Titel statt Position: fällt eine Saison um Mitternacht weg, bleibt die Auswahl stimmig.
  const season = plan.kind === 'season' ? (options.find((o) => o.title === plan.title) ?? options[0]) : null;
  const startDate: ISODate = season ? season.joinDate : startChoice === 'today' ? today : addDays(today, 1);
  const endDate: ISODate = season ? season.endDate : addDays(startDate, length - 1);
  const totalDays = diffDays(startDate, endDate) + 1;
  const autoTitle = season ? season.title : customArcTitle(length);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const title = customTitle ?? autoTitle;

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

  const sign = async () => {
    if (!crewId) {
      createArc({ title, startDate, endDate, why, rules, signatureName: name });
      setTimeout(() => router.replace('/'), 500);
      return;
    }
    // Crew-Arc: zuerst für die Crew veröffentlichen und unterschreiben, dann lokal anlegen.
    try {
      const crewRules = toCrewArcRules(rules, uid);
      const ca = await publishCrewArc({ crew_id: crewId, title: title.trim() || 'Crew Arc', why: why.trim(), start_date: startDate, end_date: endDate, rules: crewRules });
      await signCrewArc(ca.id);
      createArc({
        title: ca.title,
        startDate,
        endDate,
        why,
        // Eigene Health-Verknüpfungen behalten
        rules: crewRules.map((r, i) => ({ ...r, health: rules[i]?.health })),
        signatureName: name,
        crew: { crewId, crewArcId: ca.id, crewName: crewName ?? undefined },
      });
      setTimeout(() => router.replace({ pathname: '/crew/[id]', params: { id: crewId } }), 500);
    } catch (e) {
      setPublishError(t('crewx.arc.publishFailed', { error: e instanceof Error ? e.message : String(e) }));
      setSignKey((k) => k + 1);
    }
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
      <HoldToSign key={signKey} onSigned={sign} disabled={!canContinue} />
    );

  return (
    <Screen footer={footer}>
      {header}

      {crewId ? (
        <Card tone="accentSoft" bordered={false} style={styles.crewNote}>
          <T variant="label" color="accent">{t('crewx.arc.createFor', { crew: crewName ?? '' })}</T>
          {step === 0 ? <T variant="caption">{t('crewx.arc.createIntro')}</T> : null}
        </Card>
      ) : null}
      {publishError ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" color="danger">{publishError}</T>
        </Card>
      ) : null}

      {step === 0 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">Schritt 1 · Zeitraum</T>
            <T variant="title">{source ? 'Wie geht es weiter?' : 'Welcher Arc?'}</T>
            <T color="textSecondary">
              Das Jahr hat vier Arcs – so kann deine Crew gemeinsam starten. Oder du legst deinen eigenen Zeitraum fest.
            </T>
          </View>

          <View style={styles.options}>
            {options.map((o) => {
              const selected = season?.title === o.title;
              return (
                <Pressable
                  key={o.title}
                  onPress={() => {
                    setPlan({ kind: 'season', title: o.title });
                    setCustomTitle(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, { backgroundColor: selected ? theme.accentSoft : theme.surface, borderColor: selected ? theme.accent : theme.border }]}>
                  <T style={styles.optionIcon}>{o.season.icon}</T>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{o.title}</T>
                    <T variant="caption">
                      {o.running
                        ? `Läuft · heute einsteigen, noch ${o.daysLeft} Tage`
                        : `${formatShort(o.startDate)} – ${formatShort(o.endDate, true)} · ${o.totalDays} Tage`}
                    </T>
                    <T variant="caption" color="textTertiary">{o.season.pitch}</T>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setPlan({ kind: 'custom' });
                setCustomTitle(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: plan.kind === 'custom' }}
              style={[
                styles.option,
                {
                  backgroundColor: plan.kind === 'custom' ? theme.accentSoft : theme.surface,
                  borderColor: plan.kind === 'custom' ? theme.accent : theme.border,
                },
              ]}>
              <T style={styles.optionIcon}>🧭</T>
              <View style={styles.flex}>
                <T variant="bodyStrong">Eigener Arc</T>
                <T variant="caption">Start und Dauer frei wählen – z. B. 66 Tage für eine neue Gewohnheit.</T>
              </View>
            </Pressable>
          </View>

          {plan.kind === 'custom' && (
            <>
              <SectionTitle>Start</SectionTitle>
              <View style={styles.chips}>
                <Chip label="Heute" selected={startChoice === 'today'} onPress={() => setStartChoice('today')} />
                <Chip label="Morgen" selected={startChoice === 'tomorrow'} onPress={() => setStartChoice('tomorrow')} />
              </View>
              <SectionTitle>Dauer</SectionTitle>
              <View style={styles.chips}>
                {LENGTHS.map((l) => (
                  <Chip key={l} label={`${l} Tage`} selected={length === l} onPress={() => setLength(l)} />
                ))}
              </View>
              <Stepper value={length} onChange={setLength} min={7} max={365} format={(v) => `${v} Tage`} />
            </>
          )}

          <Card tone="accentSoft" bordered={false} style={styles.summary}>
            <T variant="label" color="accent">Dein Arc</T>
            <T variant="title">
              {formatShort(startDate)} – {formatShort(endDate, true)}
            </T>
            <T color="textSecondary">{totalDays} Tage</T>
          </Card>
          {source ? (
            <T variant="caption" color="textTertiary">
              Deine Regeln und dein «Warum» aus «{source.title}» sind schon übernommen – du kannst sie im nächsten Schritt anpassen.
            </T>
          ) : null}
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
          <TextField label="Name deines Arcs" value={title} onChangeText={setCustomTitle} maxLength={40} />
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
              {crewId
                ? t('crewx.arc.signHint')
                : 'Ein verpasster Tag ist kein Scheitern. Ich verpasse nie zwei Tage hintereinander. Ich darf diesen Vertrag höchstens dreimal ändern.'}
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
  options: { gap: Spacing.two },
  option: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.lg, borderWidth: 1.5, alignItems: 'flex-start' },
  optionIcon: { fontSize: 26, lineHeight: 32 },
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
  crewNote: { gap: 4 },
});
