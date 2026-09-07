import { cn } from '@/lib/utils';
import { gridSizeForSquad } from '@/lib/matchGrid';

// Floodlight — see docs/brand/BRAND.md. Scoped locally to this component rather than
// the shared shadcn theme tokens: the rest of the app hasn't adopted the palette yet
// (DESIGN-002), and the match header set the precedent for scoping it per-component.
const FLOODLIGHT = {
  pitchBlue: '#0B5FCC',
  onBlue: '#FFFFFF',
  onBlueDim: 'rgba(255, 255, 255, 0.82)',
  card: '#FFFFFF',
  edge: '#CBD3DC',
  navy: '#101724',
  slate: '#5A6474',
  amber: '#F5A524',
};

// A player as far as a tile is concerned. The live screen must never show a surname
// (these are minors — UX-007) or a shirt number (grassroots squads have no stable
// numbers week to week), so those fields are deliberately not part of this shape.
interface TilePlayer {
  id: string;
  first_name: string;
}

interface PlayerTileGridProps {
  activePlayers: TilePlayer[];
  benchPlayers: TilePlayer[];
  /** Minutes played so far, by player id. Displayed only — never written from here. */
  getPlayerTime: (playerId: string) => number;
  /**
   * Staged substitutions (UX-007 branch 3): tap a pitch player to select them,
   * then a bench player to stage the pair. Both grids show the EFFECTIVE lineup,
   * so a player staged to come on is passed in `activePlayers`.
   */
  onPitchTileTap?: (player: TilePlayer) => void;
  onBenchTileTap?: (player: TilePlayer) => void;
  /** Currently selected pitch player (amber ring). */
  selectedId?: string | null;
  /** Players caught in a pending pair: dashed amber border, PENDING tag, not tappable. */
  pendingIds?: ReadonlySet<string>;
  className?: string;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function PlayerTileGrid({
  activePlayers,
  benchPlayers,
  getPlayerTime,
  onPitchTileTap,
  onBenchTileTap,
  selectedId,
  pendingIds,
  className,
}: PlayerTileGridProps) {
  const squadCount = activePlayers.length + benchPlayers.length;
  const { columns, nameRem } = gridSizeForSquad(squadCount);

  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  const renderTile = (player: TilePlayer, location: 'pitch' | 'bench') => {
    const onPitch = location === 'pitch';
    const minutes = formatMinutes(getPlayerTime(player.id));
    const isPending = !!pendingIds?.has(player.id);
    const isSelected = !isPending && selectedId === player.id;
    const handler = onPitch ? onPitchTileTap : onBenchTileTap;
    // A pending player is locked out of further selection until submitted or undone —
    // otherwise the same player could be staged both on and off in one batch.
    const tappable = !isPending && !!handler;

    // Same footprint on the bench as on the pitch (UX-007): a substitution is exactly
    // when a coach is rushing, so the target must not shrink. min-h clears UX-002's
    // 44pt floor with room to spare.
    const commonClass =
      'relative flex min-h-[80px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center';

    const style: React.CSSProperties = onPitch
      ? { backgroundColor: FLOODLIGHT.pitchBlue, color: FLOODLIGHT.onBlue }
      : {
          backgroundColor: FLOODLIGHT.card,
          color: FLOODLIGHT.navy,
          border: `1px solid ${FLOODLIGHT.edge}`,
        };

    if (isSelected) {
      // Amber ring, drawn outside the tile so it doesn't shift the layout.
      style.boxShadow = `0 0 0 3px ${FLOODLIGHT.amber}`;
    }
    if (isPending) {
      // Dashed amber border via outline so the tile keeps its footprint.
      style.outline = `2px dashed ${FLOODLIGHT.amber}`;
      style.outlineOffset = '-2px';
    }

    const inner = (
      <>
        <span
          className="w-full truncate font-semibold leading-tight"
          style={{ fontSize: `${nameRem}rem` }}
        >
          {player.first_name}
        </span>
        {isPending ? (
          <span
            className="rounded-sm px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em]"
            style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
          >
            Pending
          </span>
        ) : (
          <span
            className="font-mono text-xs"
            style={{
              color: onPitch ? FLOODLIGHT.onBlueDim : FLOODLIGHT.slate,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {minutes}
          </span>
        )}
      </>
    );

    if (tappable) {
      return (
        <button
          key={player.id}
          type="button"
          aria-pressed={isSelected}
          className={cn(commonClass, 'transition-transform active:scale-[0.98]')}
          style={style}
          onClick={() => handler!(player)}
        >
          {inner}
        </button>
      );
    }

    return (
      <div key={player.id} className={commonClass} style={style}>
        {inner}
      </div>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {activePlayers.length > 0 && (
        <div>
          <div
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: FLOODLIGHT.slate }}
          >
            On field ({activePlayers.length})
          </div>
          <div className="grid gap-2" style={gridStyle}>
            {activePlayers.map((p) => renderTile(p, 'pitch'))}
          </div>
        </div>
      )}

      {benchPlayers.length > 0 && (
        <div>
          <div
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: FLOODLIGHT.slate }}
          >
            Bench ({benchPlayers.length})
          </div>
          <div className="grid gap-2" style={gridStyle}>
            {benchPlayers.map((p) => renderTile(p, 'bench'))}
          </div>
        </div>
      )}
    </div>
  );
}
