import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { useMatchStorage } from '@/hooks/useMatchStorage';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAutoSave } from '@/hooks/useAutoSave';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MatchControls } from '@/components/match/MatchControls';
import { EventDialog } from '@/components/match/EventDialog';
import { SubstitutionDialog } from '@/components/match/SubstitutionDialog';
import { 
  Users, 
  Timer,
  UserCheck,
  UserX,
  Trophy,
  TrendingUp
} from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface MatchState {
  squad: Player[];
  starters: string[];
  substitutes: Player[];
}

interface MatchEvent {
  id?: string;
  event_type: 'goal' | 'assist';
  player_id?: string;
  assist_player_id?: string;
  is_our_team: boolean;
  half: 'first' | 'second';
  minute: number;
  is_penalty?: boolean;
  created_at?: string;
}

interface PlayerTimeLog {
  player_id: string;
  is_starter: boolean;
  time_on: number | null;
  time_off: number | null;
  half: 'first' | 'second';
  total_minutes: number;
}

export default function MatchTracker() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  
  const [matchState, setMatchState] = useState<MatchState | null>(
    location.state as MatchState || (window as any).tempMatchState || null
  );
  
  const [fixture, setFixture] = useState<any>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [playerTimes, setPlayerTimes] = useState<PlayerTimeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { saveMatchStateToStorage, recoverMatchState, clearMatchFromStorage, clearExpiredMatches } = useMatchStorage(fixtureId);

  const handleSaveState = () => {
    if (fixture && matchState && timerStateRef.current) {
      saveMatchStateToStorage({
        fixture,
        matchState,
        gameState: { 
          ...timerStateRef.current, 
          events, 
          playerTimes,
          halfLength: fixture.half_length || 25 
        },
        startTimes: startTimesRef.current,
      });
    }
  };

  const {
    timerState,
    setTimerState,
    startTimes,
    setStartTimes,
    startMatch: timerStartMatch,
    toggleTimer,
    endFirstHalf: timerEndFirstHalf,
    startSecondHalf: timerStartSecondHalf,
    endMatch: timerEndMatch,
    getCurrentTime,
    getCurrentMinute,
    formatTime,
  } = useMatchTimer({ 
    halfLength: fixture?.half_length || 25,
    onSaveState: handleSaveState
  });

  // Keep refs for the auto-save callback
  const timerStateRef = useRef(timerState);
  const startTimesRef = useRef(startTimes);
  const fixtureRef = useRef(fixture);
  const matchStateRef = useRef(matchState);
  const eventsRef = useRef(events);
  const playerTimesRef = useRef(playerTimes);
  
  useEffect(() => {
    timerStateRef.current = timerState;
    startTimesRef.current = startTimes;
  }, [timerState, startTimes]);
  
  useEffect(() => {
    fixtureRef.current = fixture;
  }, [fixture]);
  
  useEffect(() => {
    matchStateRef.current = matchState;
  }, [matchState]);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  useEffect(() => {
    playerTimesRef.current = playerTimes;
  }, [playerTimes]);


  // Auto-save functionality - saves every 30 seconds during active match
  useAutoSave({
    enabled: timerState.matchPhase !== 'pre-match' && timerState.matchPhase !== 'completed',
    interval: 30000, // 30 seconds
    onSave: handleSaveState,
  });

  // Save immediately when events or player times change to avoid losing the latest action
  useEffect(() => {
    if (!fixture || !matchState) return;
    if (timerState.matchPhase === 'pre-match') return;
    handleSaveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, playerTimes]);

  // Persist on unmount (route changes/navigation within app)
  useEffect(() => {
    return () => {
      const timer = timerStateRef.current;
      const starts = startTimesRef.current;
      const fx = fixtureRef.current;
      const ms = matchStateRef.current;
      if (!fx || !ms || !timer) return;
      if (timer.matchPhase === 'pre-match') return;
      saveMatchStateToStorage({
        fixture: fx,
        matchState: ms,
        gameState: {
          ...timer,
          events: eventsRef.current || [],
          playerTimes: playerTimesRef.current || [],
          halfLength: fx.half_length || 25,
        },
        startTimes: starts,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  const [eventDialog, setEventDialog] = useState({
    open: false,
    type: 'goal' as 'goal' | 'assist',
    isOurTeam: true,
    selectedPlayer: '',
    assistPlayer: 'none',
    isPenalty: false,
  });
  
  const [substitutionDialog, setSubstitutionDialog] = useState({
    open: false,
    playerOut: '',
    playerIn: '',
  });

  useEffect(() => {
    const initializeMatch = async () => {
      if (!fixtureId || !user) return;

      try {
        // Clear any expired match data first
        clearExpiredMatches();
        
        // Try to recover match state
        const recovered = recoverMatchState();
        if (recovered) {
          setFixture(recovered.fixture);
          
          // Restore timer state and start times together
          const restoredStartTimes = recovered.startTimes;
          setStartTimes(restoredStartTimes);
          
          // Calculate current time based on stored start times if timer is running
          let restoredTimerState = recovered.gameState;
          if (restoredTimerState.isRunning && restoredStartTimes) {
            const now = Date.now();
            if (restoredTimerState.currentHalf === 'first' && restoredStartTimes.firstHalfStart) {
              const elapsed = Math.floor((now - restoredStartTimes.firstHalfStart) / 1000);
              restoredTimerState = { ...restoredTimerState, firstHalfTime: elapsed };
            } else if (restoredTimerState.currentHalf === 'second' && restoredStartTimes.secondHalfStart) {
              const elapsed = Math.floor((now - restoredStartTimes.secondHalfStart) / 1000);
              restoredTimerState = { ...restoredTimerState, secondHalfTime: elapsed };
            }
          }
          
          setTimerState(restoredTimerState);
          setEvents(recovered.gameState.events || []);
          setPlayerTimes(recovered.gameState.playerTimes || []);
          
          if (recovered.matchState) {
            setMatchState(recovered.matchState);
          }
          
          toast({
            title: "Match Recovered",
            description: "Continuing from where you left off.",
          });
          setIsLoading(false);
          return;
        }

        // Fetch fixture data
        await fetchFixture();
        
        // Initialize player times if we have match state
        if (matchState?.squad) {
          initializePlayerTimes();
        }

      } catch (error) {
        console.error('Error initializing match:', error);
        toast({
          title: "Error",
          description: "Failed to initialize match. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeMatch();
    requestWakeLock();

    return () => {
      releaseWakeLock();
    };
  }, [fixtureId, user]);

  const fetchFixture = async () => {
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        team:teams(
          id,
          name,
          team_type
        )
      `)
      .eq('id', fixtureId)
      .single();

    if (error) throw error;
    
    setFixture(data);
    setTimerState(prev => ({
      ...prev,
      halfLength: data.half_length || 25,
    }));
  };

  const initializePlayerTimes = () => {
    const currentMatchState = matchState || (location.state as MatchState);
    if (!currentMatchState?.squad || !currentMatchState?.starters) return;

    const newPlayerTimes: PlayerTimeLog[] = [];
    
    // Add starters
    currentMatchState.starters.forEach(playerId => {
      newPlayerTimes.push({
        player_id: playerId,
        is_starter: true,
        time_on: 0,
        time_off: null,
        half: 'first',
        total_minutes: 0,
      });
    });
    
    // Add substitutes (not yet playing)
    currentMatchState.squad.forEach(player => {
      if (!currentMatchState.starters.includes(player.id)) {
        newPlayerTimes.push({
          player_id: player.id,
          is_starter: false,
          time_on: null,
          time_off: null,
          half: 'first',
          total_minutes: 0,
        });
      }
    });

    setPlayerTimes(newPlayerTimes);
  };

  const startMatch = async () => {
    if (!fixture) return;
    
    timerStartMatch();

    // Update fixture status to in_progress
    try {
      await supabase
        .from('fixtures')
        .update({ status: 'in_progress' })
        .eq('id', fixtureId);
    } catch (error) {
      console.error('Error updating fixture status:', error);
    }

    requestWakeLock();

    toast({
      title: "Match Started",
      description: "The match has begun. Good luck!",
    });
  };

  const endFirstHalf = () => {
    timerEndFirstHalf();
    updatePlayerTimesForHalfEnd('first');

    toast({
      title: "First Half Ended",
      description: "Time for a break. Review your strategy!",
    });
  };

  const startSecondHalf = () => {
    timerStartSecondHalf();
    resetPlayerTimesForSecondHalf();

    toast({
      title: "Second Half Started",
      description: "Let's go for the win!",
    });
  };

  const endMatch = async () => {
    timerEndMatch();
    // Update times for any players still on the field at match end
    updatePlayerTimesForHalfEnd('second');
    releaseWakeLock();

    // Auto-save match data when ending the game
    await saveMatchData();

    toast({
      title: "Match Completed",
      description: "Match data has been automatically saved.",
    });
  };

  const recordGoal = () => {
    setEventDialog({
      open: true,
      type: 'goal',
      isOurTeam: true,
      selectedPlayer: '',
      assistPlayer: 'none',
      isPenalty: false,
    });
  };

  const handleEventConfirm = () => {
    if (eventDialog.isOurTeam && !eventDialog.selectedPlayer) return;

    const newEvent: MatchEvent = {
      event_type: 'goal',
      player_id: eventDialog.isOurTeam ? eventDialog.selectedPlayer : undefined,
      assist_player_id: (eventDialog.isOurTeam && eventDialog.assistPlayer && eventDialog.assistPlayer !== 'none') ? eventDialog.assistPlayer : undefined,
      is_our_team: eventDialog.isOurTeam,
      half: timerState.currentHalf,
      minute: getCurrentMinute(),
      is_penalty: eventDialog.isOurTeam ? eventDialog.isPenalty : false,
    };

    const updatedEvents = [newEvent];
    
    // Also add assist event if there's an assist player for our team
    if (eventDialog.isOurTeam && eventDialog.assistPlayer && eventDialog.assistPlayer !== 'none') {
      const assistEvent: MatchEvent = {
        event_type: 'assist',
        player_id: eventDialog.assistPlayer,
        is_our_team: true,
        half: timerState.currentHalf,
        minute: getCurrentMinute(),
      };
      updatedEvents.push(assistEvent);
    }

    setEvents(prev => [...prev, ...updatedEvents]);

    setEventDialog({
      open: false,
      type: 'goal',
      isOurTeam: true,
      selectedPlayer: '',
      assistPlayer: 'none',
      isPenalty: false,
    });

    handleSaveState();

    const goalDescription = eventDialog.isOurTeam 
      ? `${eventDialog.isPenalty ? 'Penalty ' : ''}Goal by ${getPlayerName(eventDialog.selectedPlayer)}${(eventDialog.assistPlayer && eventDialog.assistPlayer !== 'none') ? ` (assist: ${getPlayerName(eventDialog.assistPlayer)})` : ''}` 
      : "Opposition goal recorded";

    toast({
      title: eventDialog.isOurTeam ? "Goal Recorded!" : "Opposition Goal Recorded",
      description: goalDescription,
    });
  };

  const makeSubstitution = () => {
    setSubstitutionDialog({
      open: true,
      playerOut: '',
      playerIn: '',
    });
  };

  const handleSubstitutionConfirm = () => {
    const { playerOut, playerIn } = substitutionDialog;
    if (!playerOut || !playerIn) return;

    const currentMinute = getCurrentMinute();
    
    setPlayerTimes(prev => prev.map(pt => {
      if (pt.player_id === playerOut && pt.time_off === null) {
        // Player coming off
        return {
          ...pt,
          time_off: currentMinute,
          total_minutes: getActiveMinutes(pt, currentMinute),
        };
      }
      if (pt.player_id === playerIn && (pt.time_on === null || pt.time_off !== null)) {
        // Player coming on - either for first time or returning after being substituted
        return {
          ...pt,
          time_on: currentMinute,
          time_off: null, // Clear any previous time_off
          half: timerState.currentHalf,
        };
      }
      return pt;
    }));

    setSubstitutionDialog({
      open: false,
      playerOut: '',
      playerIn: '',
    });

    handleSaveState();

    toast({
      title: "Substitution Made",
      description: `${getPlayerName(playerIn)} replaces ${getPlayerName(playerOut)}`,
    });
  };

  // Helper functions
  const getPlayerName = (playerId: string) => {
    const player = matchState?.squad.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown';
  };

  const getActiveMinutes = (playerTime: PlayerTimeLog, currentMinute: number) => {
    if (playerTime.time_on === null) return 0;
    const endTime = playerTime.time_off || currentMinute;
    return Math.max(0, endTime - playerTime.time_on);
  };

  const updatePlayerTimesForHalfEnd = (half: 'first' | 'second') => {
    const halfLength = fixture?.half_length || 25;
    
    setPlayerTimes(prev => prev.map(pt => {
      if (pt.half === half && pt.time_on !== null && pt.time_off === null) {
        // Player was active when the half ended - calculate correct minutes for this half
        const startMinute = pt.time_on || 0;
        const minutesThisHalf = Math.max(0, halfLength - startMinute);
        return {
          ...pt,
          total_minutes: pt.total_minutes + minutesThisHalf,
          time_off: halfLength, // Mark as substituted at end of half
        };
      }
      return pt;
    }));
  };

  const resetPlayerTimesForSecondHalf = () => {
    setPlayerTimes(prev => prev.map(pt => {
      if (pt.time_on !== null && pt.time_off === null) {
        // Active players continue into second half - reset their time_on for the new half
        return {
          ...pt,
          half: 'second',
          time_on: 0, // Start from minute 0 of second half
        };
      }
      return pt;
    }));
  };

  const getActivePlayers = () => {
    return matchState?.squad.filter(player => {
      const playerTime = playerTimes.find(pt => pt.player_id === player.id);
      return playerTime?.time_on !== null && playerTime?.time_off === null;
    }) || [];
  };

  const getSubstitutePlayers = () => {
    return matchState?.squad.filter(player => {
      const playerTime = playerTimes.find(pt => pt.player_id === player.id);
      // A player can be substituted if they're currently not on the field (time_off is not null or time_on is null)
      return playerTime?.time_on === null || playerTime?.time_off !== null;
    }) || [];
  };

  const saveMatchData = async () => {
    if (!fixture || !user) return;

    try {
      setIsSaving(true);

      // Save all match events
      if (events.length > 0) {
        const eventsToSave = events.map(event => ({
          fixture_id: fixtureId,
          event_type: event.event_type,
          player_id: event.player_id || null,
          is_our_team: event.is_our_team,
          half: event.half,
          minute: event.minute,
          is_penalty: event.is_penalty || false,
        }));

        const { error: eventsError } = await supabase
          .from('match_events')
          .insert(eventsToSave);

        if (eventsError) {
          console.error('Error saving events:', eventsError);
          throw eventsError;
        }
      }

      // Save player time logs
      if (playerTimes.length > 0) {
        const timesToSave = playerTimes.map(playerTime => ({
          fixture_id: fixtureId,
          player_id: playerTime.player_id,
          is_starter: playerTime.is_starter,
          time_on: playerTime.time_on,
          time_off: playerTime.time_off,
          half: playerTime.half,
          total_minutes: playerTime.total_minutes,
        }));

        const { error: timesError } = await supabase
          .from('player_time_logs')
          .insert(timesToSave);

        if (timesError) {
          console.error('Error saving player times:', timesError);
          throw timesError;
        }
      }

      // Update fixture status
      await supabase
        .from('fixtures')
        .update({ 
          status: 'completed',
          selected_squad_data: {
            startingLineup: matchState?.starters || [],
            substitutes: matchState?.substitutes?.map(p => ({ 
              id: p.id, 
              first_name: p.first_name, 
              last_name: p.last_name, 
              jersey_number: p.jersey_number 
            })) || []
          }
        })
        .eq('id', fixtureId);

      clearMatchFromStorage();

      toast({
        title: "Match Data Saved",
        description: "All match events and player times have been saved successfully.",
      });

      // Navigate to match report
      navigate(`/match-report/${fixtureId}`);

    } catch (error) {
      console.error('Error saving match data:', error);
      toast({
        title: "Error Saving Data",
        description: "Failed to save match data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!matchState?.squad) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Squad Selected</h3>
            <p className="text-muted-foreground mb-4">
              Please select your squad from the fixture details before starting the match.
            </p>
            <Button onClick={() => navigate(`/fixture/${fixtureId}`)}>
              Go to Fixture Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Match Tracker</h1>
        {fixture && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm sm:text-base truncate">
              {fixture.team.name} vs {fixture.opponent_name}
            </p>
            {/* Current Score */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg w-full min-w-0">
              <div className="text-center flex-1 min-w-0 max-w-[40%]">
                <p className="text-xs sm:text-sm text-muted-foreground truncate px-1">{fixture.team.name}</p>
                <p className="text-2xl sm:text-3xl font-bold">{events.filter(e => e.event_type === 'goal' && e.is_our_team).length}</p>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-muted-foreground flex-shrink-0">-</div>
              <div className="text-center flex-1 min-w-0 max-w-[40%]">
                <p className="text-xs sm:text-sm text-muted-foreground truncate px-1">{fixture.opponent_name}</p>
                <p className="text-2xl sm:text-3xl font-bold">{events.filter(e => e.event_type === 'goal' && !e.is_our_team).length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Match Controls */}
      <MatchControls
        matchPhase={timerState.matchPhase}
        isRunning={timerState.isRunning}
        currentHalf={timerState.currentHalf}
        currentTime={getCurrentTime()}
        formatTime={formatTime}
        onStartMatch={startMatch}
        onToggleTimer={toggleTimer}
        onEndFirstHalf={endFirstHalf}
        onStartSecondHalf={startSecondHalf}
        onEndMatch={endMatch}
        onRecordGoal={recordGoal}
        onMakeSubstitution={makeSubstitution}
        isSquadSelected={!!matchState?.squad}
      />

      {/* Tabs for detailed views */}
      <Tabs defaultValue="events" className="w-full min-w-0">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">Match Events</TabsTrigger>
          <TabsTrigger value="squad">Squad</TabsTrigger>
          <TabsTrigger value="stats">Player Times</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Match Events</CardTitle>
              <CardDescription>Goals and assists recorded during the match</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-8 w-8 mx-auto mb-2" />
                    No events recorded yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant={event.is_our_team ? "default" : "secondary"}>
                            {event.event_type}
                          </Badge>
                          <div>
                            <p className="font-medium">
                              {event.player_id ? getPlayerName(event.player_id) : 'Opposition'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {event.half} half - {event.minute}'
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="squad" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Active Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                     {getActivePlayers().map((player) => (
                       <div key={player.id} className="flex items-center justify-between p-2 bg-muted/50 rounded min-w-0">
                         <span className="truncate">{player.jersey_number ? `#${player.jersey_number} ` : ''}{player.first_name} {player.last_name}</span>
                         <Badge variant="secondary">Active</Badge>
                       </div>
                     ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Available Substitutes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {getSubstitutePlayers().map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-muted rounded min-w-0">
                        <span className="truncate">{player.jersey_number ? `#${player.jersey_number} ` : ''}{player.first_name} {player.last_name}</span>
                        <Badge variant="outline">Available</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Player Minutes
              </CardTitle>
              <CardDescription>Time played by each player</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {playerTimes.map((playerTime) => {
                    const player = matchState?.squad.find(p => p.id === playerTime.player_id);
                    const currentMinutes = playerTime.time_on !== null 
                      ? getActiveMinutes(playerTime, getCurrentMinute()) + playerTime.total_minutes
                      : playerTime.total_minutes;

                    return (
                      <div key={playerTime.player_id} className="flex items-center justify-between p-2 bg-muted rounded min-w-0">
                        <span className="truncate flex-1 min-w-0">
                          {player?.jersey_number ? `#${player.jersey_number} ` : ''}{player?.first_name} {player?.last_name}
                        </span>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-sm font-mono">{currentMinutes} min</span>
                          <Badge variant={playerTime.is_starter ? "default" : "secondary"}>
                            {playerTime.is_starter ? "Starter" : "Sub"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Event Dialog */}
      <EventDialog
        open={eventDialog.open}
        onOpenChange={(open) => setEventDialog(prev => ({ ...prev, open }))}
        type={eventDialog.type}
        isOurTeam={eventDialog.isOurTeam}
        selectedPlayer={eventDialog.selectedPlayer}
        assistPlayer={eventDialog.assistPlayer}
        isPenalty={eventDialog.isPenalty}
        players={getActivePlayers()}
        onTypeChange={(type) => setEventDialog(prev => ({ ...prev, type }))}
        onTeamChange={(isOurTeam) => setEventDialog(prev => ({ ...prev, isOurTeam }))}
        onPlayerChange={(playerId) => setEventDialog(prev => ({ ...prev, selectedPlayer: playerId }))}
        onAssistPlayerChange={(playerId) => setEventDialog(prev => ({ ...prev, assistPlayer: playerId }))}
        onPenaltyChange={(isPenalty) => setEventDialog(prev => ({ ...prev, isPenalty }))}
        onConfirm={handleEventConfirm}
      />

      {/* Substitution Dialog */}
      <SubstitutionDialog
        open={substitutionDialog.open}
        onOpenChange={(open) => setSubstitutionDialog(prev => ({ ...prev, open }))}
        playerOut={substitutionDialog.playerOut}
        playerIn={substitutionDialog.playerIn}
        onPlayersChange={(playerOut, playerIn) => setSubstitutionDialog(prev => ({ ...prev, playerOut, playerIn }))}
        activePlayers={getActivePlayers()}
        substitutePlayers={getSubstitutePlayers()}
        onConfirm={handleSubstitutionConfirm}
      />
    </div>
  );
}