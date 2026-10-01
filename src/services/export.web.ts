import { getLang, t, tl } from '@/i18n';
import { todayISO } from '@/lib/date';
import { exportCSV, exportJSON } from '@/lib/export';
import { getState } from '@/store/store';

export type ExportFormat = 'json' | 'csv';

/** Browser: Datei herunterladen. */
export async function exportData(format: ExportFormat): Promise<void> {
  const s = getState();
  const today = todayISO(new Date(), s.settings.rolloverHour);
  const content =
    format === 'json'
      ? exportJSON(s, new Date().toISOString())
      : exportCSV(s, today, { columns: tl('extras.export.columns'), yes: t('extras.export.yes'), no: t('extras.export.no') }, getLang() === 'en' ? ',' : ';');
  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nordwand-${today}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
