import { useCallback, useMemo, useState } from 'react';
import { generateUUID } from '@/lib/uuid';
import {
  effectiveLineup,
  lockedPlayerIds,
  oldestStagedAt,
  peelLast,
  stagePair,
  type PendingPair,
} from '@/lib/pendingSubs';

/**
 * React state wrapper around the pure staged-substitution stack in
 * `src/lib/pendingSubs.ts` (UX-007 branch 3). Holds the pending pairs and the
 * currently selected pitch player; the logic (locking, peel-back order,
 * effective lineup) lives in the lib and is unit-tested there.
 *
 * The stack is local to one device and never touches the database until Submit,
 * so callers must gate `selectPitchPlayer` / `completePairWithBench` on being the
 * active tracker (`fixtures.active_tracker_id`).
 */
export function usePendingSubs() {
  const [stack, setStack] = useState<PendingPair[]>([]);
  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);

  const lockedIds = useMemo(() => lockedPlayerIds(stack), [stack]);

  /** Tap a pitch player: select, or deselect if already selected, or move the selection. */
  const selectPitchPlayer = useCallback(
    (playerId: string) => {
      if (lockedIds.has(playerId)) return;
      setSelectedOutId((prev) => (prev === playerId ? null : playerId));
    },
    [lockedIds],
  );

  /** Tap a bench player to complete the pair against the selected pitch player. */
  const completePairWithBench = useCallback(
    (benchId: string) => {
      if (!selectedOutId || lockedIds.has(benchId)) return;
      setStack((s) =>
        stagePair(s, selectedOutId, benchId, {
          makeId: generateUUID,
          makeEventIds: () => ({ offEventId: generateUUID(), onEventId: generateUUID() }),
        }),
      );
      setSelectedOutId(null);
    },
    [selectedOutId, lockedIds],
  );

  /** "Undo last" — pop the newest staged pair. */
  const undoLast = useCallback(() => {
    setStack((s) => peelLast(s));
  }, []);

  /** Drop everything staged (the guard's Discard path). */
  const discardAll = useCallback(() => {
    setStack([]);
    setSelectedOutId(null);
  }, []);

  /** Remove pairs that Submit has committed, leaving any that failed still staged. */
  const removeCommitted = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const done = new Set(ids);
    setStack((s) => s.filter((p) => !done.has(p.id)));
  }, []);

  const applyToLineup = useCallback(
    (committedPitchIds: string[], committedBenchIds: string[]) =>
      effectiveLineup(committedPitchIds, committedBenchIds),
    [],
  );

  return {
    stack,
    selectedOutId,
    lockedIds,
    oldestStagedAt: oldestStagedAt(stack),
    selectPitchPlayer,
    completePairWithBench,
    undoLast,
    discardAll,
    removeCommitted,
    applyToLineup,
  };
}
