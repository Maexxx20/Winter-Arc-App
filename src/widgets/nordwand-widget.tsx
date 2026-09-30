/**
 * Homescreen- und Sperrbildschirm-Widget (iOS).
 * Achtung: Die Funktion mit 'widget' läuft in einer eigenen, kleinen Umgebung. Sie darf nur
 * Komponenten aus @expo/ui/swift-ui nutzen, keine Hooks, keine Konstanten von ausserhalb.
 */
import { Button, Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, gaugeStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface WidgetRule {
  id: string;
  icon: string;
  title: string;
  done: boolean;
}

export interface NordwandWidgetProps {
  /** Tag, für den die Werte gelten */
  date: string;
  title: string;
  started: boolean;
  /** Kein laufender Arc */
  ended: boolean;
  daysToStart: number;
  dayNumber: number;
  totalDays: number;
  streak: number;
  done: number;
  total: number;
  /** Tägliche Abhak-Regeln (max. 4) */
  rules: WidgetRule[];
  /** Im Widget abgehakt, von der App noch nicht übernommen */
  tapped: string[];
}

function NordwandWidget(props: NordwandWidgetProps, env: WidgetEnvironment) {
  'widget';
  const accent = '#2657D9';
  const family = env.widgetFamily;
  const open = widgetURL('nordwand://');

  if (props.ended) {
    if (family === 'accessoryInline') return <Text>Nordwand · Neuer Arc?</Text>;
    if (family === 'accessoryCircular') {
      return (
        <VStack modifiers={[open]}>
          <Text modifiers={[font({ size: 20 })]}>🏔️</Text>
        </VStack>
      );
    }
    return (
      <VStack alignment="leading" spacing={4} modifiers={[open]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: 17, weight: 'bold' })]}>Kein laufender Arc</Text>
        <Text modifiers={[font({ size: 13 })]}>Tippen, um den nächsten zu starten.</Text>
      </VStack>
    );
  }

  if (!props.started) {
    if (family === 'accessoryInline') return <Text>{`Nordwand · Start in ${props.daysToStart} T.`}</Text>;
    return (
      <VStack alignment="leading" spacing={4} modifiers={[open]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {props.title}
        </Text>
        <Text modifiers={[font({ size: 34, weight: 'bold', design: 'rounded' })]}>{`${props.daysToStart}`}</Text>
        <Text modifiers={[font({ size: 13 })]}>{props.daysToStart === 1 ? 'Tag bis zum Start' : 'Tage bis zum Start'}</Text>
      </VStack>
    );
  }

  const heute = `${props.done}/${props.total} heute`;

  // ---------- Sperrbildschirm ----------
  if (family === 'accessoryInline') {
    return <Text>{`Tag ${props.dayNumber}/${props.totalDays} · 🔥 ${props.streak} · ${heute}`}</Text>;
  }
  if (family === 'accessoryCircular') {
    return (
      <Gauge value={props.total ? props.done / props.total : 0} modifiers={[gaugeStyle('circularCapacity'), open]} currentValueLabel={<Text>{`${props.dayNumber}`}</Text>}>
        <Text>Tag</Text>
      </Gauge>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[open]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{`Tag ${props.dayNumber} von ${props.totalDays}`}</Text>
        <Text modifiers={[font({ size: 13 })]}>{`🔥 ${props.streak} · ${heute}`}</Text>
        <Gauge value={props.total ? props.done / props.total : 0} modifiers={[gaugeStyle('linearCapacity')]} />
      </VStack>
    );
  }

  // ---------- Klein ----------
  const header = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>
        {props.title}
      </Text>
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 30, weight: 'bold', design: 'rounded' })]}>{`${props.dayNumber}`}</Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {`/ ${props.totalDays}`}
        </Text>
      </HStack>
    </VStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[open]}>
        {header}
        <Gauge value={props.total ? props.done / props.total : 0} modifiers={[gaugeStyle('linearCapacity'), foregroundStyle(accent)]} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{props.done === props.total && props.total > 0 ? 'Heute gehalten ✓' : heute}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{`🔥 ${props.streak} Tage`}</Text>
      </VStack>
    );
  }

  // ---------- Mittel/Gross: Regeln direkt abhaken ----------
  const toggle = (id: string) => {
    const rules = props.rules.map((r) => (r.id === id ? { ...r, done: true } : r));
    const done = props.done + (props.rules.some((r) => r.id === id && !r.done) ? 1 : 0);
    return { ...props, rules, done, tapped: [...props.tapped, id] };
  };

  return (
    <HStack alignment="top" spacing={12} modifiers={[padding({ all: 2 })]}>
      <VStack alignment="leading" spacing={6} modifiers={[open]}>
        {header}
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{`🔥 ${props.streak}`}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{heute}</Text>
      </VStack>
      <Spacer />
      <VStack alignment="leading" spacing={6}>
        {props.rules.map((r) => (
          <Button
            key={r.id}
            target={`rule-${r.id}`}
            onPress={() => (r.done ? props : toggle(r.id))}
            systemImage={r.done ? 'checkmark.circle.fill' : 'circle'}
            label={`${r.icon} ${r.title}`}
            modifiers={[font({ size: 13, weight: r.done ? 'regular' : 'medium' }), foregroundStyle(r.done ? accent : { type: 'hierarchical', style: 'primary' }), lineLimit(1)]}
          />
        ))}
      </VStack>
    </HStack>
  );
}

export default createWidget<NordwandWidgetProps>('Nordwand', NordwandWidget);
