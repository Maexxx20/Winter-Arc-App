import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HoldToSign } from '@/components/hold-to-sign';
import { ChevronIcon, CloseIcon, PencilIcon, PlusIcon } from '@/components/icons';
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
import { customArcTitle, seasonOptions, seasonPitch } from '@/lib/seasons';
import {
  categoryLabel,
  describeRule,
  HARD_MAX_RULES,
  RECOMMENDED_MAX_RULES,
  ruleTemplates,
  type RuleTemplate,
} from '@/lib/templates';
import type { Arc, RuleCategory } from '@/lib/types';
import { t, useLang } from '@/i18n';
import { uid } from '@/lib/arc';
import { type CrewArc, toCrewArcRules } from '@/lib/crew-arc';
import { cachedCrew, publishCrewArc, signCrewArc } from '@/services/crews';
import { confirm } from '@/lib/confirm';
import { createArc, getState, selectActiveArc, useAppState } from '@/store/store';

const STEPS = ['period', 'rules', 'why', 'contract'] as const;

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
  const lang = useLang();
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

  // Vorlagen in der aktuellen Sprache; einmal übernommen, sind Titel und Einheit Daten des Nutzers.
  const grouped = useMemo(() => {
    const m = new Map<RuleCategory, RuleTemplate[]>();
    for (const tpl of ruleTemplates()) m.set(tpl.category, [...(m.get(tpl.category) ?? []), tpl]);
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const isSelected = (tpl: RuleTemplate) => rules.some((r) => r.title === tpl.title);
  const toggleTemplate = (tpl: RuleTemplate) =>
    setRules((rs) => (isSelected(tpl) ? rs.filter((r) => r.title !== tpl.title) : rs.length >= HARD_MAX_RULES ? rs : [...rs, tpl]));

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const next = () => setStep(Math.min(STEPS.length - 1, step + 1));

  // Schon veröffentlichte Vorlage (falls danach etwas schiefging) – nicht doppelt veröffentlichen
  const published = useRef<CrewArc | null>(null);

  const sign = async () => {
    if (!crewId) {
      createArc({ title, startDate, endDate, why, rules, signatureName: name });
      setTimeout(() => router.replace('/'), 500);
      return;
    }
    // Crew-Arc: zuerst für die Crew veröffentlichen und unterschreiben, dann lokal anlegen.
    const running = selectActiveArc(getState());
    if (running && running.status === 'active' && running.endDate >= today) {
      const ok = await confirm(t('crewx.arc.replaceTitle'), t('crewx.arc.replaceText', { title: running.title }), t('crewx.arc.replaceConfirm'), true);
      if (!ok) {
        setSignKey((k) => k + 1);
        return;
      }
    }
    try {
      const ca =
        published.current ??
        (await publishCrewArc({
          crew_id: crewId,
          title: title.trim() || t('today.create.crewArcFallback'),
          why: why.trim(),
          start_date: startDate,
          end_date: endDate,
          rules: toCrewArcRules(rules, uid),
        }));
      published.current = ca;
      const crewRules = ca.rules;
      await signCrewArc(ca.id);
      createArc({
        title: ca.title,
        startDate,
        endDate,
        why,
        // Eigene Health-Verknüpfungen behalten
        rules: crewRules.map((r, i) => ({ ...r, health: rules[i]?.health })),
        signatureName: name,
        crew: { crewId, crewArcId: ca.id, crewName: crewName ?? undefined, ruleIds: ca.rules.map((r) => r.id) },
      });
      setTimeout(() => router.replace({ pathname: '/crew/[id]', params: { id: crewId } }), 500);
    } catch (e) {
      setPublishError(t('crewx.arc.publishFailed', { error: e instanceof Error ? e.message : String(e) }));
      setSignKey((k) => k + 1);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={back} hitSlop={12} accessibilityLabel={t('common.back')} style={[styles.round, { backgroundColor: theme.surfaceMuted }]}>
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

  // Vertragstext: {name} wird fett eingesetzt, darum in zwei Teile trennen.
  const [contractPre, contractPost = ''] = t('today.create.contractText', {
    start: formatShort(startDate),
    end: formatShort(endDate, true),
    days: t('common.days', { count: totalDays }),
  }).split('{name}');

  const footer =
    step < 3 ? (
      <Button title={t('common.next')} onPress={next} disabled={!canContinue} />
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
            <T variant="label" color="accent">{t('today.create.step1')}</T>
            <T variant="title">{source ? t('today.screen.whatsNext') : t('today.create.whichArc')}</T>
            <T color="textSecondary">{t('today.create.periodIntro')}</T>
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
                        ? t('today.create.running', { count: o.daysLeft })
                        : `${formatShort(o.startDate)} – ${formatShort(o.endDate, true)} · ${t('common.days', { count: o.totalDays })}`}
                    </T>
                    <T variant="caption" color="textTertiary">{seasonPitch(o.season)}</T>
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
                <T variant="bodyStrong">{t('today.create.customArc')}</T>
                <T variant="caption">{t('today.create.customHint')}</T>
              </View>
            </Pressable>
          </View>

          {plan.kind === 'custom' && (
            <>
              <SectionTitle>{t('today.create.start')}</SectionTitle>
              <View style={styles.chips}>
                <Chip label={t('date.today')} selected={startChoice === 'today'} onPress={() => setStartChoice('today')} />
                <Chip label={t('date.tomorrow')} selected={startChoice === 'tomorrow'} onPress={() => setStartChoice('tomorrow')} />
              </View>
              <SectionTitle>{t('today.create.duration')}</SectionTitle>
              <View style={styles.chips}>
                {LENGTHS.map((l) => (
                  <Chip key={l} label={t('common.days', { count: l })} selected={length === l} onPress={() => setLength(l)} />
                ))}
              </View>
              <Stepper value={length} onChange={setLength} min={7} max={365} format={(v) => t('common.days', { count: v })} />
            </>
          )}

          <Card tone="accentSoft" bordered={false} style={styles.summary}>
            <T variant="label" color="accent">{t('today.create.yourArc')}</T>
            <T variant="title">
              {formatShort(startDate)} – {formatShort(endDate, true)}
            </T>
            <T color="textSecondary">{t('common.days', { count: totalDays })}</T>
          </Card>
          {source ? (
            <T variant="caption" color="textTertiary">
              {t('today.create.carriedOver', { title: source.title })}
            </T>
          ) : null}
        </>
      )}

      {step === 1 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">{t('today.create.step2')}</T>
            <T variant="title">{t('today.screen.yourRules')}</T>
            <T color="textSecondary">{t('today.create.rulesIntro', { max: RECOMMENDED_MAX_RULES })}</T>
          </View>

          <SectionTitle
            action={
              <T variant="caption" color={rules.length > RECOMMENDED_MAX_RULES ? 'warning' : 'textSecondary'}>
                {rules.length}/{RECOMMENDED_MAX_RULES}
                {rules.length > RECOMMENDED_MAX_RULES ? ` · ${t('today.create.ambitious')}` : ''}
              </T>
            }>
            {t('today.create.selected')}
          </SectionTitle>

          {rules.length === 0 ? (
            <Card tone="surfaceMuted" bordered={false}>
              <T variant="caption" center>
                {t('today.create.noRule')}
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
                  <View style={[styles.round, styles.smallRound, { backgroundColor: theme.accentSoft }]} accessibilityLabel={t('common.edit')}>
                    <PencilIcon color={theme.accent} size={14} />
                  </View>
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel={t('today.create.removeRule', { title: r.title })}
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
              {t('today.create.needDaily')}
            </T>
          )}

          <Button
            title={t('today.editor.newTitle')}
            variant="secondary"
            icon={<PlusIcon color={theme.text} size={16} />}
            disabled={rules.length >= HARD_MAX_RULES}
            onPress={() => setEditor({ open: true, index: null })}
          />

          {grouped.map(([cat, templates]) => (
            <View key={cat} style={styles.group}>
              <SectionTitle>{categoryLabel(cat)}</SectionTitle>
              <View style={styles.chips}>
                {templates.map((tpl) => (
                  <Chip
                    key={tpl.title}
                    icon={tpl.icon}
                    label={tpl.title}
                    selected={isSelected(tpl)}
                    disabled={!isSelected(tpl) && rules.length >= HARD_MAX_RULES}
                    onPress={() => toggleTemplate(tpl)}
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
            <T variant="label" color="accent">{t('today.create.step3')}</T>
            <T variant="title">{t('today.create.whyTitle')}</T>
            <T color="textSecondary">{t('today.create.whyIntro')}</T>
          </View>
          <TextField label={t('today.create.arcName')} value={title} onChangeText={setCustomTitle} maxLength={40} />
          <TextField
            label={t('today.create.myWhy')}
            value={why}
            onChangeText={setWhy}
            multiline
            maxLength={400}
            placeholder={t('today.create.whyPlaceholder')}
          />
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.titleBlock}>
            <T variant="label" color="accent">{t('today.create.step4')}</T>
            <T variant="title">{t('today.create.signIt')}</T>
          </View>

          <TextField
            label={t('today.create.yourName')}
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder={t('today.create.namePlaceholder')}
          />

          <Card style={styles.contract}>
            <T variant="label" center>{t('today.create.contractWithMe')}</T>
            <T variant="heading" center style={styles.contractTitle}>{title || 'Winter Arc'}</T>
            <T color="textSecondary">
              {contractPre}
              <T variant="bodyStrong">{name.trim() || '______'}</T>
              {contractPost}
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
                {t('today.create.because', { why: why.trim() })}
              </T>
            ) : null}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <T variant="caption">
              {crewId
                ? t('crewx.arc.signHint')
                : t('today.create.pledge')}
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
