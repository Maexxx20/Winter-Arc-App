import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";
import { t } from "@/i18n";
import { useTheme } from "@/hooks/use-theme";
import { confirm } from "@/lib/confirm";
import {
  healthProviderName,
  type HealthSupport,
  healthSupport,
  requestHealthAccess,
} from "@/services/health-source";
import { syncHealthNow } from "@/services/health-sync";
import {
  connectStrava,
  disconnectStrava,
  stravaAvailableHere,
  stravaEnabled,
} from "@/services/strava";

import { supabaseConfigured, useSession } from "@/services/supabase";
import { selectActiveArc, updateSettings, useAppState } from "@/store/store";

import { Button } from "./ui/button";
import { PoweredByStrava, StravaConnectButton } from "./strava-button";
import { Card } from "./ui/card";
import { T } from "./ui/text";

const supportText = (support: Exclude<HealthSupport, "available">): string =>
  ({
    "expo-go": t("contract.connections.expoGo"),
    unsupported: t("contract.connections.unsupported"),
    "needs-app": t("contract.connections.needsApp"),
  })[support];

/** Verbindungen zu Apple Health / Health Connect und Strava. */
export function ConnectionsCard() {
  const theme = useTheme();
  const state = useAppState();
  const session = useSession();
  const [support, setSupport] = useState<HealthSupport | null>(null);
  const [busy, setBusy] = useState<"health" | "strava" | null>(null);
  const arc = selectActiveArc(state);
  const { healthEnabled, stravaAthlete } = state.settings;

  useEffect(() => {
    healthSupport().then(setSupport);
  }, []);

  const connectHealth = async () => {
    setBusy("health");
    const ok = await requestHealthAccess();
    setBusy(null);
    if (!ok) {
      await confirm(
        t("contract.connections.notConnected", {
          provider: healthProviderName,
        }),
        t("contract.connections.allowHealth"),
        t("common.ok"),
      );
      return;
    }
    updateSettings({ healthEnabled: true });
    const n = await syncHealthNow(true);
    if (n)
      await confirm(
        t("contract.connections.connected"),
        t("contract.connections.valuesTaken", { count: n }),
        t("common.ok"),
      );
  };

  const toggleStrava = async () => {
    setBusy("strava");
    const err = stravaAthlete
      ? await disconnectStrava()
      : await connectStrava();
    setBusy(null);
    if (err) await confirm("Strava", err, t("common.ok"));
    else if (!stravaAthlete) syncHealthNow(true);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.item}>
        <T variant="bodyStrong">{healthProviderName}</T>
        <T variant="caption">
          {support && support !== "available"
            ? supportText(support)
            : healthEnabled
              ? t("contract.connections.healthOn")
              : t("contract.connections.healthOff")}
        </T>
        {support === "available" ? (
          healthEnabled ? (
            <Button
              title={t("contract.connections.stopUsing")}
              variant="ghost"
              small
              onPress={() => updateSettings({ healthEnabled: false })}
            />
          ) : (
            <Button
              title={t("contract.connections.connectWith", {
                provider: healthProviderName,
              })}
              variant="secondary"
              small
              loading={busy === "health"}
              onPress={connectHealth}
            />
          )
        ) : null}
      </View>

      {stravaEnabled() || stravaAthlete ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.item}>
            <T variant="bodyStrong">Strava</T>
            <T variant="caption">
              {stravaAthlete
                ? t("contract.connections.stravaAs", { name: stravaAthlete })
                : !supabaseConfigured || !session
                  ? t("contract.connections.stravaNeedsAccount")
                  : (stravaAvailableHere() ??
                    t("contract.connections.stravaPitch"))}
            </T>
            {supabaseConfigured && session && stravaAthlete ? (
              <>
                <PoweredByStrava />
                <Button
                  title={t("contract.connections.stravaDisconnect")}
                  variant="ghost"
                  small
                  loading={busy === "strava"}
                  onPress={toggleStrava}
                />
              </>
            ) : supabaseConfigured && session && !stravaAvailableHere() ? (
              <StravaConnectButton
                loading={busy === "strava"}
                onPress={toggleStrava}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.four },
  item: { gap: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth },
});
