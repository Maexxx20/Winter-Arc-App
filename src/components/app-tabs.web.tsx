import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { T } from './ui/text';

/** Web-Variante (Vorschau im Browser): schlichte Tab-Leiste unten. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <Bar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Heute</TabButton>
          </TabTrigger>
          <TabTrigger name="verlauf" href="/verlauf" asChild>
            <TabButton>Verlauf</TabButton>
          </TabTrigger>
          <TabTrigger name="vertrag" href="/vertrag" asChild>
            <TabButton>Vertrag</TabButton>
          </TabTrigger>
        </Bar>
      </TabList>
    </Tabs>
  );
}

function Bar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <View style={styles.inner}>{props.children}</View>
    </View>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={[styles.btn, isFocused && { backgroundColor: theme.accentSoft }]}>
      <T variant="bodyStrong" color={isFocused ? 'accent' : 'textTertiary'} style={styles.label}>
        {children}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingBottom: Spacing.four,
    alignItems: 'center',
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.two },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md },
  label: { fontSize: 14 },
});
