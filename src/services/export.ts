import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getLang, t, tl } from '@/i18n';
import { todayISO } from '@/lib/date';
import { exportCSV, exportJSON } from '@/lib/export';
import { getState } from '@/store/store';

export type ExportFormat = 'json' | 'csv';

/** Daten als Datei erzeugen und über das Teilen-Menü weitergeben (Dateien, Mail, AirDrop …). */
export async function exportData(format: ExportFormat): Promise<void> {
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const content =
    format === 'json'
      ? exportJSON(s, new Date().toISOString())
      : exportCSV(s, today, { columns: tl('extras.export.columns'), yes: t('extras.export.yes'), no: t('extras.export.no') }, getLang() === 'en' ? ',' : ';');
  const file = new File(Paths.cache, `nordwand-${today}.${format}`);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: format === 'json' ? 'application/json' : 'text/csv',
    UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
    dialogTitle: t('extras.export.dialog'),
  });
}
