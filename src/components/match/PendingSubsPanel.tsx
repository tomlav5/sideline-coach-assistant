import { cn } from '@/lib/utils';
import type { PendingPair } from '@/lib/pendingSubs';

// Floodlight — see docs/brand/BRAND.md. Scoped locally like the header and tile grid;
// the app-wide token migration is DESIGN-002.
const FLOODLIGHT = {
  navy: '#101724',
  ink: '#EEF1F4',
  dim: '#8D9AAC',
  amber: '#F5A524',
};

// Semantic critical — the only place Floodlight's reds are allowed: something is
// about to be lost. Added as local constants alongside the Floodlight ones.
const RED = '#E5484D';
const RED_DEEP = '#B4232C';

interface PendingSubsPanelProps {
  pairs: PendingPair[];
  /** First name for a player id — surnames never appear on the live screen (UX-007). */
  nameFor: (playerId: string) => string;
  /** Seconds the OLDEST pending pair has been staged. Owned by the parent's clock. */
  waitedSeconds: number;
  /** True once the oldest pair has waited 60s — deep-red critical state. */
  critical: boolean;
  onUndoLast: () => void;
  /** Not the active tracker: the whole panel is inert (it should not render then anyway). */
  disabled?: boolean;
}

function formatWait(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PendingSubsPanel({
  pairs,
  nameFor,
  waitedSeconds,
  critical,
  onUndoLast,
  disabled = false,
}: PendingSubsPanelProps) {
  if (pairs.length === 0) return null;

  const mutedInk = critical ? 'rgba(255, 255, 255, 0.78)' : FLOODLIGHT.dim;

  // Resolve every row up front from the SAME list the count is taken from, so the
  // header number can never disagree with the rows rendered below it (DEFECT 4).
  // A name that will not resolve renders as "Unknown", never as nothing — a
  // counted pending pair must always be visibly present.
  const rows = [...pairs].reverse().map((pair) => ({
    id: pair.id,
    inName: nameFor(pair.inId) || 'Unknown',
    outName: nameFor(pair.outId) || 'Unknown',
  }));
  const count = rows.length;

  return (
    <div
      // The breathe is a slow ~1.6s box-shadow pulse, never a flash (>3/s fails
      // WCAG and reads as broken). It collapses to a static glow under
      // prefers-reduced-motion — see .pending-critical-breathe in src/index.css.
      className={cn('w-full border-t-2', critical && 'pending-critical-breathe')}
      style={{
        backgroundColor: critical ? RED_DEEP : FLOODLIGHT.navy,
        borderTopColor: critical ? RED : FLOODLIGHT.amber,
        color: FLOODLIGHT.ink,
      }}
      // No aria-live: the waiting timer changes every second and would spam a
      // screen reader. The panel is a persistent visual region, not an alert.
    >
      <div className="container px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: critical ? '#FFFFFF' : FLOODLIGHT.amber }}
            >
              {critical
                ? `Not submitted · ${count} sub${count === 1 ? '' : 's'}`
                : `${count} sub${count === 1 ? '' : 's'} pending`}
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: mutedInk, fontVariantNumeric: 'tabular-nums' }}
            >
              waiting {formatWait(waitedSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={onUndoLast}
            disabled={disabled}
            className="shrink-0 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
              color: FLOODLIGHT.ink,
              minHeight: 44,
            }}
          >
            Undo last
          </button>
        </div>

        {/* Newest first: "<in> on · <out> off". Exactly one row per counted pair. */}
        <ul className="mt-1.5 space-y-0.5">
          {rows.map((row) => (
            <li key={row.id} className="text-[13px] leading-snug">
              <span className="font-semibold">{row.inName}</span>
              <span style={{ color: mutedInk }}> on · </span>
              <span className="font-semibold">{row.outName}</span>
              <span style={{ color: mutedInk }}> off</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
