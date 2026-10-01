import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { MyAvatar, RemoteAvatar } from '@/components/avatar';
import { HoldToSign } from '@/components/hold-to-sign';
import { CloseIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle, TextField } from '@/components/ui/controls';
import { Screen } from '@/components/ui/screen';
import { T } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { compareRules, type CrewArc, type CrewArcSignature, isMyCrewArc, joinPeriod } from '@/lib/crew-arc';
import { diffDays, formatShort } from '@/lib/date';
import { describeRule } from '@/lib/templates';
import { cachedCrew, type CrewDetail, deleteCrewArc, loadCrew, loadCrewArcs, signCrewArc, unsignCrewArc } from '@/services/crews';
import { useSession } from '@/services/supabase';
import { createArc, getState, selectActiveArc, unlinkCrewArc, useAppState } from '@/store/store';

/** Crew-Arc ansehen, unterschreiben, Regel für Regel vergleichen. Parameter: crew, id */
export default function CrewArcScreen() {
  const theme = useTheme();
  const today = useToday();
  const state = useAppState();
  const session = useSession();
  const me = session?.user.id;
  const { crew: crewId, id } = useLocalSearchParams<{ crew: string; id: string }>();
  const [detail, setDetail] = useState<CrewDetail | null>(() => (crewId ? (cachedCrew(crewId) ?? null) : null));
  const [arcs, setArcs] = useState<CrewArc[]>([]);
  const [signatures, setSignatures] = useState<CrewArcSignature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(getState().settings.name);

  const load = useCallback(async () => {
    if (!crewId) return;
    try {
      const [d, a] = await Promise.all([loadCrew(crewId, today), loadCrewArcs(crewId)]);
      setDetail(d);
      setArcs(a.arcs);
      setSignatures(a.signatures);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [crewId, today]);

  useEffect(() => {
    load();
  }, [load]);

  const ca = arcs.find((a) => a.id === id) ?? null;
  const signers = useMemo(() => signatures.filter((s) => s.crew_arc_id === id).map((s) => s.user_id), [signatures, id]);
  const myArc = selectActiveArc(state);
  const mine = !!me && signers.includes(me);
  const linkedHere = !!ca && isMyCrewArc(myArc, ca);
  const canDelete = !!detail && !!me && (detail.crew.created_by === me || ca?.created_by === me);
  const period = ca ? joinPeriod(ca, today) : null;
  const started = !!ca && today >= ca.start_date;
  const comparison = useMemo(
    () => (ca && detail && started ? compareRules(ca, signers, detail.rows, today) : []),
    [ca, detail, started, signers, today],
  );

  const person = (uid: string) => {
    const p = detail?.profiles[uid];
    const m = detail?.members.find((x) => x.user_id === uid);
    return { name: p?.name || m?.display_name || t('common.someone'), path: p?.avatar_path };
  };

  const sign = async () => {
    if (!ca || !period || !detail) return;
    if (myArc && !linkedHere && myArc.status === 'active') {
      const ok = await confirm(t('crewx.arc.replaceTitle'), t('crewx.arc.replaceText', { title: myArc.title }), t('crewx.arc.replaceConfirm'), true);
      if (!ok) return;
    }
    setBusy(true);
    try {
      await signCrewArc(ca.id);
      if (!linkedHere) {
        createArc({
          title: ca.title,
          startDate: period.startDate,
          endDate: period.endDate,
          why: ca.why,
          rules: ca.rules.map((r) => ({ ...r })),
          signatureName: name,
          crew: { crewId: detail.crew.id, crewArcId: ca.id, crewName: detail.crew.name },
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!ca) return;
    if (!(await confirm(t('crewx.arc.leaveTitle'), t('crewx.arc.leaveText'), t('crewx.arc.leave'), true))) return;
    setBusy(true);
    try {
      await unsignCrewArc(ca.id);
      unlinkCrewArc(ca.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!ca) return;
    if (!(await confirm(t('crewx.arc.deleteTitle'), t('crewx.arc.deleteText'), t('common.delete'), true))) return;
    setBusy(true);
    try {
      await deleteCrewArc(ca.id);
      unlinkCrewArc(ca.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const total = ca ? diffDays(ca.start_date, ca.end_date) + 1 : 0;
  const nonSigners = (detail?.members ?? []).filter((m) => !signers.includes(m.user_id));

  return (
    <Screen
      topInset={Platform.OS !== 'ios'}
      footer={
        ca && period && !mine ? (
          <HoldToSign onSigned={sign} disabled={busy || name.trim().length < 2} />
        ) : undefined
      }>
      <View style={styles.header}>
        <View style={styles.flex}>
          <T variant="label" color="accent">{t('crewx.arc.label')} · {detail?.crew.name ?? ''}</T>
          <T variant="title" numberOfLines={2}>{ca?.title ?? ' '}</T>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')} style={[styles.close, { backgroundColor: theme.surfaceMuted }]}>
          <CloseIcon color={theme.text} size={16} />
        </Pressable>
      </View>

      {error ? (
        <Card tone="surfaceMuted" bordered={false}>
          <T variant="caption" color="danger">{error}</T>
        </Card>
      ) : null}

      {ca && (
        <>
          <Card tone="accentSoft" bordered={false} style={styles.gap}>
            <T variant="heading">
              {formatShort(ca.start_date)} – {formatShort(ca.end_date, true)}
            </T>
            <T color="textSecondary">
              {today < ca.start_date
                ? t('crewx.arc.startsOn', { date: formatShort(ca.start_date) })
                : today > ca.end_date
                  ? t('crewx.arc.ended')
                  : t('crewx.arc.running', { day: diffDays(ca.start_date, today) + 1, total })}
            </T>
          </Card>

          {ca.why ? (
            <>
              <SectionTitle>{t('crewx.arc.whyTitle')}</SectionTitle>
              <T style={styles.italic}>«{ca.why}»</T>
            </>
          ) : null}

          <SectionTitle>{started && comparison.length ? t('crewx.arc.todayTitle') : t('crewx.arc.rulesTitle')}</SectionTitle>
          <View style={styles.list}>
            {ca.rules.map((r) => {
              const cmp = comparison.find((c) => c.rule.id === r.id);
              return (
                <View key={r.id} style={[styles.rule, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <T style={styles.emoji}>{r.icon}</T>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{r.title}</T>
                    <T variant="caption">{describeRule(r)}</T>
                    {cmp ? (
                      <View style={styles.doneRow}>
                        {cmp.doneBy.slice(0, 8).map((uid) => (
                          <RemoteAvatar key={uid} id={uid} name={person(uid).name} path={person(uid).path} size={20} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {cmp ? (
                    <T variant="bodyStrong" color={cmp.doneBy.length === signers.length && signers.length ? 'accent' : 'textSecondary'}>
                      {t('crewx.arc.ruleDone', { done: cmp.doneBy.length, total: signers.length })}
                    </T>
                  ) : null}
                </View>
              );
            })}
          </View>

          <SectionTitle>{t('crewx.arc.signersTitle')} · {signers.length}</SectionTitle>
          <Card style={styles.gap}>
            {signers.length === 0 ? <T variant="caption">{t('crewx.arc.nobodyYet')}</T> : null}
            {signers.map((uid) => (
              <View key={uid} style={styles.person}>
                {uid === me ? <MyAvatar size={32} /> : <RemoteAvatar id={uid} name={person(uid).name} path={person(uid).path} size={32} />}
                <T variant="bodyStrong" style={styles.flex}>{person(uid).name}</T>
                <T color="accent">✓</T>
              </View>
            ))}
            {nonSigners.map((m) => (
              <View key={m.user_id} style={[styles.person, styles.dim]}>
                <RemoteAvatar id={m.user_id} name={person(m.user_id).name} path={person(m.user_id).path} size={32} />
                <T style={styles.flex}>{person(m.user_id).name}</T>
                <T variant="caption">{t('crewx.arc.notYet')}</T>
              </View>
            ))}
          </Card>

          {!mine && period ? (
            <>
              <SectionTitle>{t('crewx.arc.signTitle')}</SectionTitle>
              <T variant="caption">{t('crewx.arc.signHint')}</T>
              {period.startDate > ca.start_date ? <T variant="caption" color="warning">{t('crewx.arc.lateJoin')}</T> : null}
              <TextField label={t('crewx.arc.yourName')} value={name} onChangeText={setName} maxLength={40} />
            </>
          ) : null}

          {mine ? <Button title={t('crewx.arc.leave')} variant="ghost" small disabled={busy} onPress={withdraw} /> : null}
          {canDelete ? <Button title={t('crewx.arc.delete')} variant="ghost" small disabled={busy} onPress={remove} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.two },
  flex: { flex: 1 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: Spacing.two },
  italic: { fontStyle: 'italic' },
  list: { gap: Spacing.two },
  rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 22, lineHeight: 28 },
  doneRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dim: { opacity: 0.55 },
});
