import { cn } from '@/lib/utils';

interface FixedMatchHeaderProps {
  teamName: string;
  opponentName: string;
  ourScore: number;
  opponentScore: number;
  currentTime: string;
  totalTime: string;
  periodNumber: number;
  matchStatus: string;
  className?: string;
}

// Floodlight — see docs/brand/BRAND.md. Scoped to this header rather than the shared
// shadcn theme tokens, since the rest of the app hasn't adopted the palette yet.
const FLOODLIGHT = {
  navy: '#101724',
  ink: '#EEF1F4',
  dim: '#8D9AAC',
  amber: '#F5A524',
  chipBg: 'rgba(238, 241, 244, 0.12)',
};

export function FixedMatchHeader({
  teamName,
  opponentName,
  ourScore,
  opponentScore,
  currentTime,
  totalTime,
  periodNumber,
  matchStatus,
  className,
}: FixedMatchHeaderProps) {
  const isLive = matchStatus === 'in_progress';
  const isPaused = matchStatus === 'paused';

  return (
    <div
      className={cn('sticky top-0 z-40 w-full', className)}
      style={{ backgroundColor: FLOODLIGHT.navy, color: FLOODLIGHT.ink }}
    >
      <div className="container px-4 pb-[11px] pt-[13px]">
        {/* Team names */}
        <div className="flex items-baseline justify-between gap-2.5">
          <span
            className="min-w-0 truncate text-[10.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: FLOODLIGHT.dim }}
          >
            {teamName}
          </span>
          <span
            className="min-w-0 truncate text-right text-[10.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: FLOODLIGHT.dim }}
          >
            {opponentName}
          </span>
        </div>

        {/* Score + clocks */}
        <div className="mt-0.5 flex items-center justify-between">
          <div
            className="font-mono text-[2.9rem] font-semibold leading-none tracking-[-0.02em]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {ourScore}–{opponentScore}
          </div>

          <div className="text-right">
            <div
              className="font-mono text-[1.85rem] font-semibold leading-none"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {currentTime}
            </div>
            <div
              className="mt-[3px] font-mono text-[10.5px]"
              style={{ color: FLOODLIGHT.dim, fontVariantNumeric: 'tabular-nums' }}
            >
              match {totalTime}
            </div>
          </div>
        </div>

        {/* Period chip + live/paused status */}
        <div className="mt-[7px] flex items-center gap-2">
          {periodNumber > 0 && (
            <span
              className="inline-block rounded-[3px] px-[9px] py-1 text-[9.5px] font-bold uppercase tracking-[0.14em]"
              style={{ backgroundColor: FLOODLIGHT.chipBg }}
            >
              P{periodNumber}
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: FLOODLIGHT.amber }}
              />
              <span
                className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{ color: FLOODLIGHT.dim }}
              >
                Live
              </span>
            </span>
          )}
          {isPaused && (
            <span
              className="text-[9.5px] font-bold uppercase tracking-[0.14em]"
              style={{ color: FLOODLIGHT.dim }}
            >
              Paused
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
