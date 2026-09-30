import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { HEALTH_METRIC_BY_ID, HEALTH_METRICS, formatThreshold } from '@/lib/health';
import type { HealthLink } from '@/lib/types';

import { Chip, Stepper } from './ui/controls';
import { T } from './ui/text';

/** Auswahl: welche Messung hakt die Regel automatisch ab, und ab welchem Wert? */
export function HealthLinkPicker({ value, onChange }: { value: HealthLink | undefined; onChange: (v: HealthLink | undefined) => void }) {
  const def = value ? HEALTH_METRIC_BY_ID[value.metric] : null;
  return (
    <View style={styles.group}>
      <View style={styles.chips}>
        <Chip label="Aus" selected={!value} onPress={() => onChange(undefined)} />
        {HEALTH_METRICS.map((m) => (
          <Chip
            key={m.id}
            label={`${m.icon} ${m.label}`}
            selected={value?.metric === m.id}
            onPress={() => onChange({ metric: m.id, threshold: value?.metric === m.id ? value.threshold : m.defaultThreshold })}
          />
        ))}
      </View>
      {value && def ? (
        <>
          <View style={styles.inline}>
            <T variant="body" color="textSecondary">Erledigt ab</T>
            <Stepper
              value={value.threshold}
              min={def.min}
              max={def.max}
              step={def.step}
              format={(v) => formatThreshold(value.metric, v)}
              onChange={(threshold) => onChange({ ...value, threshold })}
            />
          </View>
          <T variant="caption" color="textTertiary">
            {def.hint}. Kommt aus Apple Health bzw. Health Connect{value.metric === 'workout' ? ' oder Strava' : ''}. Von Hand abhaken geht weiterhin.
          </T>
        </>
      ) : (
        <T variant="caption" color="textTertiary">
          Nordwand kann diese Regel automatisch abhaken – mit Werten deiner Uhr oder Fitness-App.
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
});
