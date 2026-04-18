import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Goal, ArrowUpDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function LiveEventsSummary({ 
  events, 
  players, 
  loading = false,
  className 
}: LiveEventsSummaryProps) {
  // Show most recent events first
  const recentEvents = [...events].reverse().slice(0, 5);

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
            {recentEvents.map((event) => {
              const scorer = event.players 
                ? `${event.players.first_name} ${event.players.last_name}` 
                : null;
              const assistProvider = event.assist_players 
                ? `${event.assist_players.first_name} ${event.assist_players.last_name}` 
                : null;
              const subOut = players.find(p => p.id === event.player_id);
              const subIn = players.find(p => p.id === event.assist_player_id);

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm"
                >
                  {/* Time Badge */}
                  <Badge variant="secondary" className="text-xs font-mono shrink-0 px-2 py-0.5">
                    {event.total_match_minute}'
                  </Badge>

                  {/* Event Icon & Details */}
                  {event.event_type === 'goal' && (
                    <>
                      <Goal className={cn(
                        "h-4 w-4 shrink-0",
                        event.is_our_team ? "text-green-600" : "text-red-600"
                      )} />
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

                  {event.event_type === 'substitution_on' && subIn && (
                    <>
                      <ArrowUpDown className="h-4 w-4 text-yellow-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {subIn.first_name} {subIn.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">Sub ON</div>
                      </div>
                    </>
                  )}

                  {event.event_type === 'substitution_off' && subOut && (
                    <>
                      <ArrowUpDown className="h-4 w-4 text-yellow-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {subOut.first_name} {subOut.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">Sub OFF</div>
                      </div>
                    </>
                  )}

                  {event.event_type === 'yellow_card' && (
                    <>
                      <div className="h-4 w-3 bg-yellow-400 border border-yellow-600 rounded-sm shrink-0" />
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
                      <div className="h-4 w-3 bg-red-600 border border-red-800 rounded-sm shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {scorer || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">Red Card</div>
                      </div>
                    </>
                  )}

                  {!['goal', 'substitution_on', 'substitution_off', 'yellow_card', 'red_card'].includes(event.event_type) && (
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
