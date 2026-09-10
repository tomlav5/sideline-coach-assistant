import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Goal, ArrowUpDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Floodlight — see docs/brand/BRAND.md. Scoped locally, per the precedent set by the
// header/tile-grid branches (DESIGN-002 covers the app-wide token migration). This
// row is a neutral card: navy text, Slate for secondary detail, no undo affordance
// here yet so no amber (that arrives with UX-007 branch 4's history sheet).
const FLOODLIGHT = {
  navy: '#101724',
  card: '#FFFFFF',
  slate: '#5A6474',
};

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface MatchEvent {
  id: string;
  event_type: string;
  period_id: string;
  player_id?: string;
  assist_player_id?: string;
  sub_out_player_id?: string;
  sub_in_player_id?: string;
  minute_in_period: number;
  total_match_minute: number;
  is_our_team: boolean;
  is_penalty?: boolean;
  notes?: string;
  players?: Player & { id: string };
  assist_players?: Player & { id: string };
}

interface LiveEventsSummaryProps {
  events: MatchEvent[];
  players: Player[];
  loading?: boolean;
  className?: string;
}

// A substitution is written as a pair of rows — `substitution_off` (player_id =
// player coming off) and `substitution_on` (player_id = player coming on),
// stamped at the same minute. The old code looked the "on" player up via
// assist_player_id, which is always null on these rows, so every substitution_on
// rendered a blank card (FIX 5). Collapse the pair into one row instead, keyed by
// period + minute, matching how the pending panel and the match log show it.
type SubItem = {
  kind: 'sub';
  key: string;
  minute: number;
  onIds: string[];
  offIds: string[];
};
type EventItem = { kind: 'event'; key: string; event: MatchEvent };
type DisplayItem = SubItem | EventItem;

const SUB_TYPES = new Set(['substitution_on', 'substitution_off', 'substitution']);

function buildDisplayItems(events: MatchEvent[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const subByKey = new Map<string, SubItem>();

  for (const event of events) {
    if (SUB_TYPES.has(event.event_type)) {
      const key = `sub:${event.period_id}:${event.total_match_minute}`;
      let item = subByKey.get(key);
      if (!item) {
        item = { kind: 'sub', key, minute: event.total_match_minute, onIds: [], offIds: [] };
        subByKey.set(key, item);
        items.push(item);
      }
      if (event.event_type === 'substitution_on' && event.player_id) {
        item.onIds.push(event.player_id);
      } else if (event.event_type === 'substitution_off' && event.player_id) {
        item.offIds.push(event.player_id);
      }
      continue;
    }
    items.push({ kind: 'event', key: event.id, event });
  }

  return items;
}

export function LiveEventsSummary({
  events,
  players,
  loading = false,
  className
}: LiveEventsSummaryProps) {
  const nameOf = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown';
  };

  // Pair up substitutions before slicing, so a pair is never split across the
  // 5-item cut-off. Most recent first.
  const recentItems = buildDisplayItems(events).reverse().slice(0, 5);

  if (loading) {
    return (
      <div className={cn(
        "border-t bg-muted/30 backdrop-blur supports-[backdrop-filter]:bg-muted/20",
        className
      )}>
        <div className="container px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading events...</span>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn(
        "border-t bg-muted/30 backdrop-blur supports-[backdrop-filter]:bg-muted/20",
        className
      )}>
        <div className="container px-4 py-2">
          <div className="text-center text-sm text-muted-foreground">
            No events recorded yet
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Events ({events.length})
          </span>
        </div>

        <ScrollArea className="h-24">
          <div className="space-y-1.5">
            {recentItems.map((item) => {
              if (item.kind === 'sub') {
                // One row pairing the off and on players, e.g. "Milo on · Kai off".
                const onNames = item.onIds.map(nameOf).join(', ');
                const offNames = item.offIds.map(nameOf).join(', ');
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm"
                  >
                    <Badge variant="secondary" className="text-xs font-mono shrink-0 px-2 py-0.5">
                      {item.minute}'
                    </Badge>
                    <ArrowUpDown className="h-4 w-4 shrink-0" style={{ color: FLOODLIGHT.slate }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {onNames && <span>{onNames} on</span>}
                        {onNames && offNames && (
                          <span className="text-muted-foreground"> · </span>
                        )}
                        {offNames && <span>{offNames} off</span>}
                        {!onNames && !offNames && <span>Substitution</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">Substitution</div>
                    </div>
                  </div>
                );
              }

              const event = item.event;
              const scorer = event.players
                ? `${event.players.first_name} ${event.players.last_name}`
                : null;
              const assistProvider = event.assist_players
                ? `${event.assist_players.first_name} ${event.assist_players.last_name}`
                : null;

              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm"
                >
                  {/* Time Badge */}
                  <Badge variant="secondary" className="text-xs font-mono shrink-0 px-2 py-0.5">
                    {event.total_match_minute}'
                  </Badge>

                  {/* Event Icon & Details */}
                  {event.event_type === 'goal' && (
                    <>
                      <Goal
                        className="h-4 w-4 shrink-0"
                        style={{ color: event.is_our_team ? FLOODLIGHT.navy : FLOODLIGHT.slate }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold truncate">
                            {scorer || 'Unknown'}
                          </span>
                          {event.is_penalty && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">PEN</Badge>
                          )}
                          {!event.is_our_team && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">OPP</Badge>
                          )}
                        </div>
                        {assistProvider && (
                          <div className="text-xs text-muted-foreground truncate">
                            Assist: {assistProvider}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {event.event_type === 'yellow_card' && (
                    <>
                      <div
                        className="h-4 w-3 border-2 rounded-sm shrink-0"
                        style={{ backgroundColor: FLOODLIGHT.card, borderColor: FLOODLIGHT.navy }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {scorer || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">Yellow Card</div>
                      </div>
                    </>
                  )}

                  {event.event_type === 'red_card' && (
                    <>
                      <div
                        className="h-4 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: FLOODLIGHT.navy }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {scorer || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">Red Card</div>
                      </div>
                    </>
                  )}

                  {!['goal', 'yellow_card', 'red_card'].includes(event.event_type) && (
                    <>
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </div>
                        {scorer && (
                          <div className="text-xs text-muted-foreground truncate">
                            {scorer}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
