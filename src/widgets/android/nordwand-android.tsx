/**
 * Android-Widget (react-native-android-widget): klein = Tag & Streak, gross = Regeln direkt abhaken.
 * Gezeichnet wird mit den Widget-Bausteinen der Bibliothek, nicht mit normalen React-Native-Views.
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { Colors } from '@/constants/theme';
import type { WidgetData } from '@/lib/widget-data';

type Hex = `#${string}`;
type Palette = { bg: Hex; surface: Hex; text: Hex; muted: Hex; accent: Hex; track: Hex };

const palette = (mode: 'light' | 'dark'): Palette => {
  const c = Colors[mode];
  return {
    bg: c.surface as Hex,
    surface: c.surfaceMuted as Hex,
    text: c.text as Hex,
    muted: c.textSecondary as Hex,
    accent: c.accent as Hex,
    track: c.surfaceMuted as Hex,
  };
};

const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'nordwand://' } } as const;

function Bar({ ratio, p }: { ratio: number; p: Palette }) {
  const r = Math.max(0, Math.min(1, ratio));
  return (
    <FlexWidget style={{ width: 'match_parent', height: 6, borderRadius: 3, backgroundColor: p.track, flexDirection: 'row' }}>
      {r > 0 ? <FlexWidget style={{ flex: Math.round(r * 100), height: 6, borderRadius: 3, backgroundColor: p.accent }} /> : null}
      {r < 1 ? <FlexWidget style={{ flex: 100 - Math.round(r * 100), height: 6 }} /> : null}
    </FlexWidget>
  );
}

function Header({ d, p }: { d: WidgetData; p: Palette }) {
  return (
    <FlexWidget style={{ flexDirection: 'column' }}>
      <TextWidget text={d.title} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: p.muted }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <TextWidget text={`${d.dayNumber}`} style={{ fontSize: 30, fontWeight: '700', color: p.text }} />
        <TextWidget text={` / ${d.totalDays}`} style={{ fontSize: 13, fontWeight: '500', color: p.muted, marginBottom: 5 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Layout({ d, wide, p }: { d: WidgetData; wide: boolean; p: Palette }) {
  const L = d.labels;
  const root = { height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 14 } as const;
  const today = L.today.replace('{done}', `${d.done}`).replace('{total}', `${d.total}`);

  if (d.ended) {
    return (
      <FlexWidget {...OPEN} style={{ ...root, flexDirection: 'column', justifyContent: 'center' }}>
        <TextWidget text={d.title} maxLines={1} style={{ fontSize: 12, fontWeight: '600', color: p.muted }} />
        <TextWidget text={L.noArc} style={{ fontSize: 17, fontWeight: '700', color: p.text }} />
        <TextWidget text={L.noArcHint} style={{ fontSize: 13, color: p.muted }} />
      </FlexWidget>
    );
  }
  if (!d.started) {
    return (
      <FlexWidget {...OPEN} style={{ ...root, flexDirection: 'column', justifyContent: 'center' }}>
        <TextWidget text={d.title} maxLines={1} style={{ fontSize: 12, fontWeight: '600', color: p.muted }} />
        <TextWidget text={`${d.daysToStart}`} style={{ fontSize: 34, fontWeight: '700', color: p.text }} />
        <TextWidget text={L.untilStart} style={{ fontSize: 13, color: p.text }} />
      </FlexWidget>
    );
  }

  const left = (
    <FlexWidget {...OPEN} style={{ flexDirection: 'column', justifyContent: 'space-between', height: 'match_parent', width: wide ? 120 : 'match_parent' }}>
      <Header d={d} p={p} />
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 6 }}>
        <Bar ratio={d.total ? d.done / d.total : 0} p={p} />
        <TextWidget text={d.total > 0 && d.done === d.total ? L.held : today} style={{ fontSize: 13, fontWeight: '600', color: p.text }} />
        <TextWidget text={L.streak} style={{ fontSize: 13, color: p.muted }} />
      </FlexWidget>
    </FlexWidget>
  );
  if (!wide) return <FlexWidget style={{ ...root, flexDirection: 'column' }}>{left}</FlexWidget>;

  return (
    <FlexWidget style={{ ...root, flexDirection: 'row', flexGap: 12 }}>
      {left}
      <FlexWidget style={{ flex: 1, flexDirection: 'column', height: 'match_parent', justifyContent: 'center', flexGap: 6 }}>
        {d.rules.length && d.rules.every((r) => r.done) ? (
          <TextWidget text={L.allDone} style={{ fontSize: 14, fontWeight: '600', color: p.accent }} />
        ) : (
          d.rules.map((r) => (
            <FlexWidget
              key={r.id}
              clickAction={r.done ? 'OPEN_APP' : 'TOGGLE_RULE'}
              clickActionData={{ ruleId: r.id, date: d.date }}
              style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, flexGap: 8 }}>
              <TextWidget text={r.done ? '✓' : '○'} style={{ fontSize: 15, fontWeight: '700', color: r.done ? p.accent : p.muted }} />
              <TextWidget
                text={`${r.icon} ${r.title}`}
                maxLines={1}
                truncate="END"
                style={{ fontSize: 13, fontWeight: r.done ? '400' : '600', color: r.done ? p.muted : p.text }}
              />
            </FlexWidget>
          ))
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

/** Hell und dunkel; ab ~250 dp Breite mit Regeln zum Abhaken. */
export function NordwandAndroidWidget({ data, width }: { data: WidgetData; width: number }) {
  const wide = width >= 250;
  return {
    light: <Layout d={data} wide={wide} p={palette('light')} />,
    dark: <Layout d={data} wide={wide} p={palette('dark')} />,
  };
}
