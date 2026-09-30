import { describe, expect, it } from 'vitest';

import { currentSeason, nextSeason, seasonOptions } from '../seasons';

describe('Saisons', () => {
  it('decken das ganze Jahr ab', () => {
    expect(currentSeason('2027-01-01').season.id).toBe('newyear');
    expect(currentSeason('2027-03-31').season.id).toBe('newyear');
    expect(currentSeason('2027-04-01').season.id).toBe('spring');
    expect(currentSeason('2027-09-30').season.id).toBe('summer');
    expect(currentSeason('2026-12-31').season.id).toBe('winter');
  });
  it('Winter Arc hat 92 Tage, nächste Saison über den Jahreswechsel', () => {
    expect(currentSeason('2026-10-01')).toMatchObject({ title: 'Winter Arc 2026', startDate: '2026-10-01', endDate: '2026-12-31', totalDays: 92 });
    expect(nextSeason('2026-11-15')).toMatchObject({ title: 'New Year Arc 2027', startDate: '2027-01-01', endDate: '2027-03-31', totalDays: 90 });
  });
  it('Optionen: laufende Saison zum Einsteigen und die nächste', () => {
    const o = seasonOptions('2026-10-15');
    expect(o.map((x) => [x.title, x.joinDate, x.running, x.daysLeft])).toEqual([
      ['Winter Arc 2026', '2026-10-15', true, 78],
      ['New Year Arc 2027', '2027-01-01', false, 90],
    ]);
  });
  it('am ersten Tag läuft die Saison noch nicht', () => {
    expect(seasonOptions('2026-10-01')[0]).toMatchObject({ running: false, joinDate: '2026-10-01', daysLeft: 92 });
  });
  it('kurz vor Schluss nur noch die nächste Saison', () => {
    const o = seasonOptions('2026-12-20');
    expect(o.map((x) => x.title)).toEqual(['New Year Arc 2027']);
  });
});
