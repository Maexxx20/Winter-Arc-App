import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { loadBlocks, unblockUser, useBlocks } from '@/services/blocks';

import { Button } from './ui/button';
import { Card } from './ui/card';
import { T } from './ui/text';

/** Liste blockierter Personen mit «Blockierung aufheben». Erscheint nur, wenn jemand blockiert ist. */
export function BlockedList() {
  const blocks = useBlocks();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBlocks(true).catch(() => undefined);
  }, []);

  if (!blocks.length) return null;
  return (
    <Card style={styles.card}>
      <T variant="label">{t('crewx.mod.blockedListTitle')}</T>
      {blocks.map((b) => (
        <View key={b.blocked} style={styles.row}>
          <T style={styles.flex} numberOfLines={1}>
            {b.name || t('common.someone')}
          </T>
          <Button
            title={t('crewx.mod.unblock')}
            variant="ghost"
            small
            onPress={() => unblockUser(b.blocked).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
          />
        </View>
      ))}
      {error ? (
        <T variant="caption" color="danger">
          {error}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
