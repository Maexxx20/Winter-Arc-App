import { useMemo } from 'react';

import { allBadges, type EarnedBadge } from '@/lib/badges';
import { useAppState } from '@/store/store';

import { useToday } from './use-today';

/** Alle verdienten Abzeichen über alle Arcs. */
export function useBadges(): EarnedBadge[] {
  const { arcs, logs, reviews } = useAppState();
  const today = useToday();
  return useMemo(() => allBadges(arcs, logs, reviews, today), [arcs, logs, reviews, today]);
}
