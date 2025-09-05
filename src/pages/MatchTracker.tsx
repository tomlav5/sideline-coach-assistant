import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Target, 
  Users, 
  Flag, 
  RotateCcw,
  Timer,
  UserCheck,
  UserX,
  Trophy,
  TrendingUp,
  ArrowUpDown
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface GameState {
  currentHalf: 'first' | 'second';
  isRunning: boolean;
  halfLength: number; // in minutes
  firstHalfTime: number; // in seconds
  secondHalfTime: number; // in seconds
  events: MatchEvent[];
  playerTimes: PlayerTimeLog[];
  matchPhase: 'pre-match' | 'first-half' | 'half-time' | 'second-half' | 'completed';
}

interface MatchEvent {
  id?: string;
  event_type: 'goal' | 'assist';
  player_id?: string;
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
  
  const matchState = location.state as MatchState;
  const intervalRef = useRef<NodeJS.Timeout>();
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  const [fixture, setFixture] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState>({
    currentHalf: 'first',
    isRunning: false,
    halfLength: 25,
    firstHalfTime: 0,
    secondHalfTime: 0,
    events: [],
    playerTimes: [],
    matchPhase: 'pre-match',
  });
  
  const [startTimes, setStartTimes] = useState({
    matchStart: 0,
    firstHalfStart: 0,
    secondHalfStart: 0,
  });
  
  const [eventDialog, setEventDialog] = useState({
    open: false,
    type: 'goal' as 'goal' | 'assist',
    isOurTeam: true,
  });
  
  const [substitutionDialog, setSubstitutionDialog] = useState({
    open: false,
    playerOut: '',
    playerIn: '',
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initializeMatch = async () => {
      if (!fixtureId || !user) return;

      try {
        // Try to recover match state first
        const recovered = recoverMatchState();
        if (recovered) {
          toast({
            title: "Match Recovered",
            description: "Continuing from where you left off.",
          });
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

    // Request wake lock
    requestWakeLock();

    // Handle visibility change (app going to background/foreground)
    const handleVisibilityChange = () => {
      if (document.hidden && gameState.isRunning) {
        // Save state when going to background
        saveMatchStateToStorage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fixtureId, user]);

  useEffect(() => {
    if (gameState.isRunning) {
      intervalRef.current = setInterval(() => {
        setGameState(prev => {
          const newState = { ...prev };
          if (newState.currentHalf === 'first') {
            newState.firstHalfTime += 1;
          } else {
            newState.secondHalfTime += 1;
          }
          return newState;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [gameState.isRunning]);

  // Auto-save every 30 seconds during active match
  useEffect(() => {
    if (gameState.matchPhase !== 'pre-match') {
      const autoSaveInterval = setInterval(() => {
        saveMatchStateToStorage();
      }, 30000);

      return () => clearInterval(autoSaveInterval);
    }
  }, [gameState.matchPhase]);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (error) {
      console.error('Wake lock failed:', error);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

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
    setGameState(prev => ({
      ...prev,
      halfLength: data.half_length || 25,
    }));
  };

  const saveMatchStateToStorage = () => {
    if (!fixtureId) return;
    
    const matchData = {
      fixture,
      matchState,
      gameState,
      startTimes,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`match_${fixtureId}`, JSON.stringify(matchData));
  };

  const recoverMatchState = () => {
    if (!fixtureId) return false;
    
    const stored = localStorage.getItem(`match_${fixtureId}`);
    if (!stored) return false;
    
    try {
      const matchData = JSON.parse(stored);
      const timeSinceLastSave = Date.now() - matchData.timestamp;
      
      // Only recover if less than 12 hours old and not completed
      if (timeSinceLastSave < 12 * 60 * 60 * 1000 && matchData.gameState?.matchPhase !== 'completed') {
        setFixture(matchData.fixture);
        setGameState(matchData.gameState);
        setStartTimes(matchData.startTimes);
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Error recovering match state:', error);
    }
    
    return false;
  };

  const clearMatchFromStorage = () => {
    if (fixtureId) {
      localStorage.removeItem(`match_${fixtureId}`);
    }
  };

  const initializePlayerTimes = () => {
    if (!matchState?.squad || !matchState?.starters) return;

    const playerTimes: PlayerTimeLog[] = [];
    
    // Add starters
    matchState.starters.forEach(playerId => {
      playerTimes.push({
        player_id: playerId,
        is_starter: true,
        time_on: 0,
        time_off: null,
        half: 'first',
        total_minutes: 0,
      });
    });
    
    // Add substitutes (not yet playing)
    matchState.squad.forEach(player => {
      if (!matchState.starters.includes(player.id)) {
        playerTimes.push({
          player_id: player.id,
          is_starter: false,
          time_on: null,
          time_off: null,
          half: 'first',
          total_minutes: 0,
        });
      }
    });

    setGameState(prev => ({
      ...prev,
      playerTimes,
    }));
  };

  const startMatch = async () => {
    if (!fixture) return;
    
    const newStartTimes = { ...startTimes };
    newStartTimes.matchStart = Date.now();
    newStartTimes.firstHalfStart = Date.now();
    setStartTimes(newStartTimes);

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      matchPhase: 'first-half',
    }));

    // Update fixture status to in_progress
    try {
      await supabase
        .from('fixtures')
        .update({ match_status: 'in_progress' })
        .eq('id', fixtureId);
    } catch (error) {
      console.error('Error updating fixture status:', error);
    }

    // Request wake lock when match starts
    requestWakeLock();

    // Save state immediately
    saveMatchStateToStorage();

    toast({
      title: "Match Started",
      description: "The match has begun. Good luck!",
    });
  };

  const toggleTimer = () => {
    setGameState(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
    }));

    // Save state when pausing/resuming
    saveMatchStateToStorage();
  };

  const endFirstHalf = () => {
    setGameState(prev => ({
      ...prev,
      isRunning: false,
      matchPhase: 'half-time',
    }));

    // Update player times for first half
    updatePlayerTimesForHalfEnd('first');

    toast({
      title: "First Half Ended",
      description: "Time for a break. Review your strategy!",
    });

    saveMatchStateToStorage();
  };

  const startSecondHalf = () => {
    const newStartTimes = { ...startTimes };
    newStartTimes.secondHalfStart = Date.now();
    setStartTimes(newStartTimes);

    setGameState(prev => ({
      ...prev,
      currentHalf: 'second',
      isRunning: true,
      matchPhase: 'second-half',
      secondHalfTime: 0,
    }));

    // Reset player times for second half
    resetPlayerTimesForSecondHalf();

    toast({
      title: "Second Half Started",
      description: "Let's go for the win!",
    });

    saveMatchStateToStorage();
  };

  const endMatch = () => {
    setGameState(prev => ({
      ...prev,
      isRunning: false,
      matchPhase: 'completed',
    }));

    // Update player times for second half
    updatePlayerTimesForHalfEnd('second');

    // Release wake lock
    releaseWakeLock();

    toast({
      title: "Match Completed",
      description: "Great game! Don't forget to save your match data.",
    });

    saveMatchStateToStorage();
  };

  const saveMatchData = async () => {
    if (!fixture || !user) return;

    try {
      setIsSaving(true);

      // Save all match events
      if (gameState.events.length > 0) {
        const eventsToSave = gameState.events.map(event => ({
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
      if (gameState.playerTimes.length > 0) {
        const timesToSave = gameState.playerTimes.map(playerTime => ({
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

      // Update fixture with final score and completion status
      const ourGoals = gameState.events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
      const opponentGoals = gameState.events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;
      
      const { error: fixtureError } = await supabase
        .from('fixtures')
        .update({ 
          status: 'completed',
          match_status: 'completed'
        })
        .eq('id', fixtureId);

      if (fixtureError) {
        console.error('Error updating fixture:', fixtureError);
        throw fixtureError;
      }

      // Clear the stored match data
      clearMatchFromStorage();

      toast({
        title: "Match Saved",
        description: "All match data has been saved successfully.",
      });

      // Navigate back to fixtures
      navigate('/fixtures');

    } catch (error) {
      console.error('Error saving match data:', error);
      toast({
        title: "Error",
        description: "Failed to save match data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlayerTimesForHalfEnd = (half: 'first' | 'second') => {
    const currentTime = getCurrentTime();
    
    setGameState(prev => ({
      ...prev,
      playerTimes: prev.playerTimes.map(playerTime => {
        if (playerTime.half === half && playerTime.time_on !== null && playerTime.time_off === null) {
          const minutesPlayed = Math.floor((currentTime - playerTime.time_on) / 60);
          return {
            ...playerTime,
            time_off: currentTime,
            total_minutes: playerTime.total_minutes + minutesPlayed,
          };
        }
        return playerTime;
      }),
    }));
  };

  const resetPlayerTimesForSecondHalf = () => {
    setGameState(prev => ({
      ...prev,
      playerTimes: prev.playerTimes.map(playerTime => {
        // Keep players who were on the field at end of first half
        if (playerTime.half === 'first' && playerTime.time_off === null) {
          return {
            ...playerTime,
            half: 'second',
            time_on: 0, // Reset for second half
            time_off: null,
          };
        }
        return playerTime;
      }),
    }));
  };

  const getCurrentTime = () => {
    return gameState.currentHalf === 'first' ? gameState.firstHalfTime : gameState.secondHalfTime;
  };

  const getCurrentMinute = () => {
    return Math.floor(getCurrentTime() / 60) + 1;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openEventDialog = (type: 'goal' | 'assist', isOurTeam: boolean = true) => {
    setEventDialog({
      open: true,
      type,
      isOurTeam,
    });
  };

  const closeEventDialog = () => {
    setEventDialog({
      open: false,
      type: 'goal',
      isOurTeam: true,
    });
  };

  const addEvent = (playerId: string | null, isPenalty: boolean = false) => {
    const newEvent: MatchEvent = {
      event_type: eventDialog.type,
      player_id: playerId || undefined,
      is_our_team: eventDialog.isOurTeam,
      half: gameState.currentHalf,
      minute: getCurrentMinute(),
      is_penalty: isPenalty,
    };

    setGameState(prev => ({
      ...prev,
      events: [...prev.events, newEvent],
    }));

    closeEventDialog();
    saveMatchStateToStorage();

    toast({
      title: `${eventDialog.type.charAt(0).toUpperCase() + eventDialog.type.slice(1)} Recorded`,
      description: `${eventDialog.isOurTeam ? 'Our' : 'Opponent'} ${eventDialog.type} at ${getCurrentMinute()}'`,
    });
  };

  const makeSubstitution = (playerOutId: string, playerInId: string) => {
    const currentTime = getCurrentTime();
    
    setGameState(prev => ({
      ...prev,
      playerTimes: prev.playerTimes.map(playerTime => {
        // Player coming off
        if (playerTime.player_id === playerOutId && playerTime.time_off === null) {
          const minutesPlayed = Math.floor((currentTime - (playerTime.time_on || 0)) / 60);
          return {
            ...playerTime,
            time_off: currentTime,
            total_minutes: playerTime.total_minutes + minutesPlayed,
          };
        }
        // Player coming on
        if (playerTime.player_id === playerInId && playerTime.time_on === null) {
          return {
            ...playerTime,
            time_on: currentTime,
            half: gameState.currentHalf,
          };
        }
        return playerTime;
      }),
    }));

    setSubstitutionDialog({ open: false, playerOut: '', playerIn: '' });
    saveMatchStateToStorage();

    const playerOutName = getPlayerName(playerOutId);
    const playerInName = getPlayerName(playerInId);

    toast({
      title: "Substitution Made",
      description: `${playerInName} on for ${playerOutName} at ${getCurrentMinute()}'`,
    });
  };

  const getPlayerName = (playerId: string) => {
    const player = matchState?.squad?.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown';
  };

  const getActiveMinutes = (playerId: string) => {
    const playerTime = gameState.playerTimes.find(pt => pt.player_id === playerId);
    if (!playerTime || playerTime.time_on === null) return 0;
    
    const currentTime = getCurrentTime();
    const endTime = playerTime.time_off || currentTime;
    return Math.floor((endTime - playerTime.time_on) / 60);
  };

  const getPlayersOnField = () => {
    return gameState.playerTimes.filter(pt => 
      pt.time_on !== null && pt.time_off === null
    ).map(pt => pt.player_id);
  };

  const getAvailableSubstitutes = () => {
    const onField = getPlayersOnField();
    return matchState?.squad?.filter(p => !onField.includes(p.id)) || [];
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg">Loading match...</div>
        </div>
      </div>
    );
  }

  if (!fixture || !matchState?.squad) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Invalid Match Setup</h2>
            <p className="text-muted-foreground mb-4">
              This match doesn't have a proper squad selected. Please go back and select your squad first.
            </p>
            <Button onClick={() => navigate('/fixtures')}>
              Back to Fixtures
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ourGoals = gameState.events.filter(e => e.event_type === 'goal' && e.is_our_team).length;
  const opponentGoals = gameState.events.filter(e => e.event_type === 'goal' && !e.is_our_team).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Live Match Tracking</h1>
            <p className="text-muted-foreground">
              {fixture.team.name} vs {fixture.opponent_name}
            </p>
          </div>
        </div>

        {/* Score and Timer */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Score */}
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  {ourGoals} - {opponentGoals}
                </div>
                <div className="text-sm text-muted-foreground">
                  {fixture.team.name} vs {fixture.opponent_name}
                </div>
              </div>

              {/* Timer */}
              <div className="text-center">
                <div className="text-3xl font-mono font-bold mb-2">
                  {formatTime(getCurrentTime())}
                </div>
                <div className="text-sm text-muted-foreground">
                  {gameState.currentHalf === 'first' ? 'First Half' : 'Second Half'}
                  {gameState.matchPhase === 'half-time' && ' - Half Time'}
                  {gameState.matchPhase === 'completed' && ' - Full Time'}
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-2">
                {gameState.matchPhase === 'pre-match' && (
                  <Button onClick={startMatch} size="lg">
                    <Play className="h-5 w-5 mr-2" />
                    Start Match
                  </Button>
                )}

                {gameState.matchPhase === 'first-half' && (
                  <>
                    <Button onClick={toggleTimer} variant="outline">
                      {gameState.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button onClick={endFirstHalf}>
                      <Square className="h-4 w-4 mr-2" />
                      End Half
                    </Button>
                  </>
                )}

                {gameState.matchPhase === 'half-time' && (
                  <Button onClick={startSecondHalf} size="lg">
                    <Play className="h-5 w-5 mr-2" />
                    Start 2nd Half
                  </Button>
                )}

                {gameState.matchPhase === 'second-half' && (
                  <>
                    <Button onClick={toggleTimer} variant="outline">
                      {gameState.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button onClick={endMatch}>
                      <Square className="h-4 w-4 mr-2" />
                      End Match
                    </Button>
                  </>
                )}

                {gameState.matchPhase === 'completed' && (
                  <Button onClick={saveMatchData} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Match'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="lineup">Lineup</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {/* Event Buttons */}
          {gameState.matchPhase !== 'pre-match' && gameState.matchPhase !== 'completed' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Record Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button
                    onClick={() => openEventDialog('goal', true)}
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4" />
                    Our Goal
                  </Button>
                  <Button
                    onClick={() => openEventDialog('goal', false)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4" />
                    Opponent Goal
                  </Button>
                  <Button
                    onClick={() => openEventDialog('assist', true)}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Our Assist
                  </Button>
                  <Button
                    onClick={() => setSubstitutionDialog({ ...substitutionDialog, open: true })}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Substitution
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Events Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Match Events</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {gameState.events.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No events recorded yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gameState.events.map((event, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 border rounded">
                        <Badge variant={event.is_our_team ? "default" : "secondary"}>
                          {event.minute}'
                        </Badge>
                        <div className="flex items-center gap-2">
                          {event.event_type === 'goal' && <Trophy className="h-4 w-4" />}
                          {event.event_type === 'assist' && <TrendingUp className="h-4 w-4" />}
                          <span className="capitalize">{event.event_type}</span>
                          {event.is_penalty && <Badge variant="outline">Penalty</Badge>}
                        </div>
                        <div className="flex-1 text-right">
                          {event.player_id ? getPlayerName(event.player_id) : 'Unknown Player'}
                          <div className="text-xs text-muted-foreground">
                            {event.is_our_team ? fixture.team.name : fixture.opponent_name}
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

        <TabsContent value="lineup" className="space-y-4">
          {/* Current Lineup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  On Field
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {getPlayersOnField().map(playerId => {
                      const player = matchState.squad.find(p => p.id === playerId);
                      if (!player) return null;
                      
                      return (
                        <div key={playerId} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">
                              {player.first_name} {player.last_name}
                            </div>
                            {player.jersey_number && (
                              <div className="text-xs text-muted-foreground">
                                #{player.jersey_number}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {getActiveMinutes(playerId)}min
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Substitutes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {getAvailableSubstitutes().map(player => (
                      <div key={player.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">
                            {player.first_name} {player.last_name}
                          </div>
                          {player.jersey_number && (
                            <div className="text-xs text-muted-foreground">
                              #{player.jersey_number}
                            </div>
                          )}
                        </div>
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
          {/* Match Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>{fixture.team.name}</span>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {ourGoals}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{fixture.opponent_name}</span>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {opponentGoals}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assists</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>{fixture.team.name}</span>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {gameState.events.filter(e => e.event_type === 'assist' && e.is_our_team).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{fixture.opponent_name}</span>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {gameState.events.filter(e => e.event_type === 'assist' && !e.is_our_team).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Dialog */}
      <Dialog open={eventDialog.open} onOpenChange={closeEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Record {eventDialog.type.charAt(0).toUpperCase() + eventDialog.type.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Select the player and event details for this {eventDialog.type}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Player</Label>
              <Select onValueChange={(value) => {
                if (value === 'unknown') {
                  addEvent(null);
                } else {
                  addEvent(value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {eventDialog.isOurTeam ? (
                    getPlayersOnField().map(playerId => {
                      const player = matchState.squad.find(p => p.id === playerId);
                      return player ? (
                        <SelectItem key={player.id} value={player.id}>
                          {player.first_name} {player.last_name}
                          {player.jersey_number && ` (#${player.jersey_number})`}
                        </SelectItem>
                      ) : null;
                    })
                  ) : (
                    <SelectItem value="unknown">Opponent Player</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {eventDialog.type === 'goal' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="penalty"
                  onCheckedChange={(checked) => {
                    if (checked && eventDialog.isOurTeam) {
                      const playerId = getPlayersOnField()[0]; // Default to first player
                      addEvent(playerId, true);
                    }
                  }}
                />
                <Label htmlFor="penalty">Penalty Goal</Label>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={substitutionDialog.open} onOpenChange={(open) => 
        setSubstitutionDialog({ ...substitutionDialog, open })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Substitution</DialogTitle>
            <DialogDescription>
              Select which player to substitute and who comes on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Player Coming Off</Label>
              <Select
                value={substitutionDialog.playerOut}
                onValueChange={(value) => 
                  setSubstitutionDialog({ ...substitutionDialog, playerOut: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select player to substitute" />
                </SelectTrigger>
                <SelectContent>
                  {getPlayersOnField().map(playerId => {
                    const player = matchState.squad.find(p => p.id === playerId);
                    return player ? (
                      <SelectItem key={player.id} value={player.id}>
                        {player.first_name} {player.last_name}
                        {player.jersey_number && ` (#${player.jersey_number})`}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Player Coming On</Label>
              <Select
                value={substitutionDialog.playerIn}
                onValueChange={(value) => 
                  setSubstitutionDialog({ ...substitutionDialog, playerIn: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select substitute" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubstitutes().map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.first_name} {player.last_name}
                      {player.jersey_number && ` (#${player.jersey_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => makeSubstitution(substitutionDialog.playerOut, substitutionDialog.playerIn)}
              disabled={!substitutionDialog.playerOut || !substitutionDialog.playerIn}
              className="w-full"
            >
              Make Substitution
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
