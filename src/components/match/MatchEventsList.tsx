import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Goal, Users, Clock, ArrowUpDown } from 'lucide-react';

interface MatchEvent {
  id: string;
  event_type: 'goal' | 'assist' | 'throw_in' | 'corner' | 'free_kick' | 'penalty' | 'goal_kick' | 'substitution';
  minute: number;
  half: 'first' | 'second';
  is_our_team: boolean;
  player_id: string;
  assist_player_id?: string; // For substitutions, this holds the player coming in
  is_penalty?: boolean;
  notes?: string;
}

interface MatchEventsListProps {
  events: MatchEvent[];
  getPlayerName: (playerId: string) => string;
}

export const MatchEventsList = memo(({ events, getPlayerName }: MatchEventsListProps) => {
  const sortedEvents = useMemo(() => 
    events.sort((a, b) => {
      if (a.half !== b.half) {
        return a.half === 'first' ? -1 : 1;
      }
      return a.minute - b.minute;
    }), [events]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'goal':
        return <Goal className="h-4 w-4" />;
      case 'assist':
        return <Users className="h-4 w-4" />;
      case 'substitution':
        return <ArrowUpDown className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string, isOurTeam: boolean) => {
    if (eventType === 'goal') {
      return isOurTeam ? 'bg-green-500' : 'bg-red-500';
    }
    if (eventType === 'assist') {
      return isOurTeam ? 'bg-blue-500' : 'bg-orange-500';
    }
    if (eventType === 'substitution') {
      return 'bg-purple-500';
    }
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Match Events</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedEvents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No events recorded yet</p>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((event) => (
              <div key={event.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <div className={`p-2 rounded-full text-white ${getEventColor(event.event_type, event.is_our_team)}`}>
                  {getEventIcon(event.event_type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">
                      {event.event_type === 'substitution' ? (
                        <>
                          {getPlayerName(event.player_id)} → {getPlayerName(event.assist_player_id || '')}
                        </>
                      ) : (
                        getPlayerName(event.player_id)
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {event.minute}' {event.half.charAt(0).toUpperCase() + event.half.slice(1)}
                    </Badge>
                    {event.is_penalty && (
                      <Badge variant="destructive" className="text-xs">Penalty</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {event.event_type === 'substitution' ? (
                      'Substitution'
                    ) : (
                      <>
                        {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                        {event.is_our_team ? ' (Our Team)' : ' (Opposition)'}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

MatchEventsList.displayName = 'MatchEventsList';