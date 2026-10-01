/**
 * Datenexport (getestet): alles als JSON oder die Häkchen als Tabelle (CSV).
 * Fotos sind nicht dabei – sie liegen als Dateien auf dem Gerät.
 */

import { isRuleActiveOn, isValueDone } from './arc';
import { type ISODate, minISO, rangeDays } from './date';
import type { AppState } from './types';

export const EXPORT_VERSION = 1;

/** Alles ausser technischen Sync-Daten, als lesbares JSON. */
export function exportJSON(state: AppState, exportedAt: string): string {
  const { sync: _sync, healthAuto: _auto, photoLog: _photos, ...rest } = state;
  return JSON.stringify({ app: 'Nordwand', version: EXPORT_VERSION, exportedAt, ...rest }, null, 2);
}

function cell(v: string | number, sep: string): string {
  // Texte, die Excel als Formel lesen würde, entschärfen
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvLabels {
  columns: readonly string[];
  yes: string;
  no: string;
}

/**
 * Eine Zeile pro Tag und Regel (bis heute), die Notiz in der ersten Zeile des Tages.
 * Trennzeichen: «;» (Excel in der Schweiz) bzw. «,» auf Englisch. Mit BOM, damit Umlaute stimmen.
 */
export function exportCSV(state: AppState, today: ISODate, labels: CsvLabels, sep = ';'): string {
  const lines = [labels.columns.map((c) => cell(c, sep)).join(sep)];
  for (const arc of state.arcs) {
    const log = state.logs[arc.id] ?? {};
    if (arc.startDate > today) continue;
    for (const date of rangeDays(arc.startDate, minISO(arc.endDate, today))) {
      const entry = log[date];
      let note = entry?.note?.trim() ?? '';
      for (const rule of arc.rules) {
        if (!isRuleActiveOn(rule, date)) continue;
        const value = entry?.values[rule.id] ?? 0;
        const unit = rule.measure.kind === 'amount' ? rule.measure.unit : '';
        const done = isValueDone(rule, value);
        lines.push([date, arc.title, rule.title, value, unit, done ? labels.yes : labels.no, note].map((v) => cell(v, sep)).join(sep));
        note = '';
      }
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
