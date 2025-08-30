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
  ArrowLeft,
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
}

interface MatchEvent {
  id?: string;
  event_type: 'goal' | 'assist' | 'throw_in' | 'corner' | 'free_kick' | 'penalty';
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

export default function MatchDay() {
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
  });
  
  const [eventDialog, setEventDialog] = useState<{
    open: boolean;
    type: MatchEvent['event_type'] | null;
    isOurTeam: boolean;
  }>({
    open: false,
    type: null,
    isOurTeam: true,
  });
  
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedAssist, setSelectedAssist] = useState<string>('');
  const [isPenalty, setIsPenalty] = useState(false);
  const [substitutionDialog, setSubstitutionDialog] = useState({
    open: false,
    playerOff: '',
    playerOn: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchState) {
      navigate('/fixtures');
      return;
    }
    
    fetchFixture();
    initializePlayerTimes();
    requestWakeLock();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (gameState.isRunning) {
      intervalRef.current = setInterval(() => {
        setGameState(prev => ({
          ...prev,
          [prev.currentHalf === 'first' ? 'firstHalfTime' : 'secondHalfTime']: 
            prev.currentHalf === 'first' ? prev.firstHalfTime + 1 : prev.secondHalfTime + 1
        }));
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

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Screen wake lock activated');
      }
    } catch (err) {
      console.log('Wake lock request failed:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Screen wake lock released');
    }
  };

  const fetchFixture = async () => {
    try {
      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          *,
          teams!inner(name, team_type)
        `)
        .eq('id', fixtureId)
        .single();

      if (error) throw error;
      setFixture(data);
    } catch (error) {
      console.error('Error fetching fixture:', error);
      toast({
        title: "Error",
        description: "Failed to load fixture data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializePlayerTimes = () => {
    if (!matchState) return;
    
    const initialTimes: PlayerTimeLog[] = [];
    
    // Initialize starters
    matchState.starters.forEach(playerId => {
      initialTimes.push({
        player_id: playerId,
        is_starter: true,
        time_on: 0,
        time_off: null,
        half: 'first',
        total_minutes: 0,
      });
    });
    
    // Initialize substitutes
    matchState.substitutes.forEach(sub => {
      initialTimes.push({
        player_id: sub.id,
        is_starter: false,
        time_on: null,
        time_off: null,
        half: 'first',
        total_minutes: 0,
      });
    });
    
    setGameState(prev => ({ ...prev, playerTimes: initialTimes }));
  };

  const toggleTimer = () => {
    setGameState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const endHalf = () => {
    setGameState(prev => ({ ...prev, isRunning: false }));
    
    if (gameState.currentHalf === 'first') {
      toast({
        title: "First Half Ended",
        description: "Get ready for the second half",
      });
    } else {
      toast({
        title: "Match Ended",
        description: "Time to save match data",
      });
    }
  };

  const startSecondHalf = () => {
    setGameState(prev => ({
      ...prev,
      currentHalf: 'second',
      isRunning: true,
    }));
    
    toast({
      title: "Second Half Started",
      description: "Timer reset for second half",
    });
  };

  const getCurrentTime = () => {
    return gameState.currentHalf === 'first' ? gameState.firstHalfTime : gameState.secondHalfTime;
  };

  const getCurrentMinute = () => {
    return Math.floor(getCurrentTime() / 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openEventDialog = (type: MatchEvent['event_type'], isOurTeam: boolean) => {
    setEventDialog({ open: true, type, isOurTeam });
    setSelectedPlayer('');
    setSelectedAssist('');
    setIsPenalty(false);
  };

  const closeEventDialog = () => {
    setEventDialog({ open: false, type: null, isOurTeam: true });
    setSelectedPlayer('');
    setSelectedAssist('');
  };

  const addEvent = async () => {
    if (!eventDialog.type) return;
    
    try {
      // First add the main event (goal)
      const event: MatchEvent = {
        event_type: eventDialog.type,
        player_id: eventDialog.isOurTeam && selectedPlayer ? selectedPlayer : undefined,
        is_our_team: eventDialog.isOurTeam,
        half: gameState.currentHalf,
        minute: getCurrentMinute(),
        is_penalty: isPenalty,
      };

      const { error } = await supabase
        .from('match_events')
        .insert([{
          ...event,
          fixture_id: fixtureId,
        }]);

      if (error) throw error;

      // Add to local state
      setGameState(prev => ({
        ...prev,
        events: [...prev.events, event],
      }));

      // If it's a goal and there's an assist, add the assist event too
      if (eventDialog.type === 'goal' && selectedAssist && selectedAssist !== 'none' && eventDialog.isOurTeam) {
        const assistEvent: MatchEvent = {
          event_type: 'assist',
          player_id: selectedAssist,
          is_our_team: true,
          half: gameState.currentHalf,
          minute: getCurrentMinute(),
          is_penalty: false,
        };

        const { error: assistError } = await supabase
          .from('match_events')
          .insert([{
            ...assistEvent,
            fixture_id: fixtureId,
          }]);

        if (!assistError) {
          setGameState(prev => ({
            ...prev,
            events: [...prev.events, assistEvent],
          }));
        }
      }
      
      toast({
        title: "Event Added",
        description: `${eventDialog.type} recorded at minute ${getCurrentMinute()}${selectedAssist && selectedAssist !== 'none' && eventDialog.type === 'goal' ? ' with assist' : ''}`,
      });
      
      closeEventDialog();
    } catch (error) {
      console.error('Error adding event:', error);
      toast({
        title: "Error",
        description: "Failed to add event",
        variant: "destructive",
      });
    }
  };

  const makeSubstitution = (playerOn: string, playerOff: string) => {
    const currentTime = getCurrentTime();
    
    setGameState(prev => ({
      ...prev,
      playerTimes: prev.playerTimes.map(pt => {
        if (pt.player_id === playerOff && pt.time_off === null) {
          return { ...pt, time_off: currentTime };
        }
        if (pt.player_id === playerOn && pt.time_on === null) {
          return { ...pt, time_on: currentTime, half: gameState.currentHalf };
        }
        return pt;
      }),
    }));

    toast({
      title: "Substitution Made",
      description: `Player substituted at ${getCurrentMinute()}'`,
    });
  };

  const getPlayerName = (playerId: string) => {
    const player = matchState?.squad.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown';
  };

  const getActiveMinutes = (playerLog: PlayerTimeLog) => {
    const currentTime = getCurrentTime();
    
    if (playerLog.time_on === null) return 0;
    
    const endTime = playerLog.time_off || currentTime;
    return Math.floor((endTime - playerLog.time_on) / 60);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!matchState || !fixture) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Invalid match setup</h1>
          <Button onClick={() => navigate('/fixtures')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fixtures
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden ${gameState.isRunning ? 'match-active' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate(`/squad/${fixtureId}`)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Squad
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Match Day</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {fixture.teams.name} vs {fixture.opponent_name}
            </p>
          </div>
        </div>
      </div>

      {/* Timer and Match Control */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="text-center space-y-4">
            {/* Match Score */}
            <div className="flex items-center justify-center space-x-6 md:space-x-8">
              <div className="text-center flex-1 max-w-32">
                <p className="text-sm md:text-base font-medium text-muted-foreground truncate">{fixture.teams.name}</p>
                <div className="text-3xl md:text-4xl font-bold text-green-600">
                  {gameState.events.filter(e => e.event_type === 'goal' && e.is_our_team).length}
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-muted-foreground px-2">-</div>
              <div className="text-center flex-1 max-w-32">
                <p className="text-sm md:text-base font-medium text-muted-foreground truncate">{fixture.opponent_name}</p>
                <div className="text-3xl md:text-4xl font-bold text-red-600">
                  {gameState.events.filter(e => e.event_type === 'goal' && !e.is_our_team).length}
                </div>
              </div>
            </div>
            
            {/* Timer */}
            <div className="text-3xl md:text-5xl font-mono font-bold">
              {formatTime(getCurrentTime())}
            </div>
            
            <div className="flex items-center justify-center space-x-2">
              <Badge variant={gameState.currentHalf === 'first' ? 'default' : 'secondary'}>
                {gameState.currentHalf === 'first' ? '1st Half' : '2nd Half'}
              </Badge>
              <Badge variant="outline">
                {getCurrentMinute()}' / {gameState.halfLength}'
              </Badge>
              {gameState.isRunning && (
                <Badge variant="default" className="animate-pulse">
                  LIVE
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
              <Button
                onClick={toggleTimer}
                size="lg"
                variant={gameState.isRunning ? 'destructive' : 'default'}
              >
                {gameState.isRunning ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start
                  </>
                )}
              </Button>
              
              <Button onClick={endHalf} variant="outline">
                <Square className="h-4 w-4 mr-2" />
                End Half
              </Button>
              
              {gameState.currentHalf === 'first' && !gameState.isRunning && (
                <Button onClick={startSecondHalf} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start 2nd Half
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events" className="text-xs md:text-sm">Match Events</TabsTrigger>
          <TabsTrigger value="players" className="text-xs md:text-sm">Line Up</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs md:text-sm">Match Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4 md:space-y-6">
          {/* Event Buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Our Team Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">{fixture.teams.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-2">
                <Button
                  onClick={() => openEventDialog('goal', true)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Goal
                </Button>
                <Button
                  onClick={() => openEventDialog('corner', true)}
                  variant="outline"
                  className="w-full"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Corner
                </Button>
                <Button
                  onClick={() => openEventDialog('free_kick', true)}
                  variant="outline"
                  className="w-full"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Free Kick
                </Button>
                <Button
                  onClick={() => openEventDialog('throw_in', true)}
                  variant="outline"
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Throw In
                </Button>
                <Button
                  onClick={() => openEventDialog('penalty', true)}
                  variant="outline"
                  className="w-full"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Penalty
                </Button>
              </CardContent>
            </Card>

            {/* Opponent Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">{fixture.opponent_name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-2">
                <Button
                  onClick={() => openEventDialog('goal', false)}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Goal
                </Button>
                <Button
                  onClick={() => openEventDialog('corner', false)}
                  variant="outline"
                  className="w-full"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Corner
                </Button>
                <Button
                  onClick={() => openEventDialog('free_kick', false)}
                  variant="outline"
                  className="w-full"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Free Kick
                </Button>
                <Button
                  onClick={() => openEventDialog('throw_in', false)}
                  variant="outline"
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Throw In
                </Button>
                <Button
                  onClick={() => openEventDialog('penalty', false)}
                  variant="outline"
                  className="w-full"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Penalty
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Events Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Match Events</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {gameState.events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No events yet. Start tracking match events above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gameState.events
                      .sort((a, b) => b.minute - a.minute)
                      .map((event, index) => (
                        <div
                          key={index}
                          className={`
                            flex items-center justify-between p-3 rounded-lg border
                            ${event.is_our_team ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:bg-red-950'}
                          `}
                        >
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline">
                              {event.minute}' {event.half === 'first' ? '1H' : '2H'}
                            </Badge>
                            <span className="font-medium capitalize">
                              {event.event_type.replace('_', ' ')}
                              {event.is_penalty && ' (Penalty)'}
                            </span>
                            {event.player_id && (
                              <span className="text-sm text-muted-foreground">
                                {getPlayerName(event.player_id)}
                              </span>
                            )}
                          </div>
                          <Badge variant={event.is_our_team ? 'default' : 'destructive'}>
                            {event.is_our_team ? fixture.teams.name : fixture.opponent_name}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Line Up & Playing Time</span>
                <Button 
                  onClick={() => setSubstitutionDialog({ open: true, playerOff: '', playerOn: '' })}
                  size="sm"
                  variant="outline"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Make Substitution
                </Button>
              </CardTitle>
              <CardDescription>
                Track player minutes and make substitutions during the match
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="space-y-3">
                {gameState.playerTimes.map((playerLog) => {
                  const player = matchState.squad.find(p => p.id === playerLog.player_id);
                  const isActive = playerLog.time_on !== null && playerLog.time_off === null;
                  const minutesPlayed = getActiveMinutes(playerLog);
                  
                  return (
                    <div
                      key={playerLog.player_id}
                      className={`
                        flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border gap-2
                        ${isActive ? 'border-green-200 bg-green-50 dark:bg-green-950' : 'border-muted'}
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        {isActive ? (
                          <UserCheck className="h-5 w-5 text-green-600" />
                        ) : (
                          <UserX className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-sm md:text-base">
                            {player?.first_name} {player?.last_name}
                            {player?.jersey_number && ` (#${player.jersey_number})`}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {playerLog.is_starter ? 'Starter' : 'Substitute'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between sm:text-right">
                        <div>
                          <p className="font-medium text-sm md:text-base">
                            {minutesPlayed}' played
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {isActive ? 'On field' : 'Off field'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Goals</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold">
                  {gameState.events.filter(e => e.event_type === 'goal' && e.is_our_team).length}
                  {' - '}
                  {gameState.events.filter(e => e.event_type === 'goal' && !e.is_our_team).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  {fixture.teams.name} - {fixture.opponent_name}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Corners</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold">
                  {gameState.events.filter(e => e.event_type === 'corner' && e.is_our_team).length}
                  {' - '}
                  {gameState.events.filter(e => e.event_type === 'corner' && !e.is_our_team).length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Free Kicks</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold">
                  {gameState.events.filter(e => e.event_type === 'free_kick' && e.is_our_team).length}
                  {' - '}
                  {gameState.events.filter(e => e.event_type === 'free_kick' && !e.is_our_team).length}
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
              Add {eventDialog.type?.replace('_', ' ')} Event
            </DialogTitle>
            <DialogDescription>
              Record a {eventDialog.type} for {eventDialog.isOurTeam ? fixture.teams.name : fixture.opponent_name} at minute {getCurrentMinute()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {eventDialog.isOurTeam && (eventDialog.type === 'goal') && (
              <div>
                <Label>Goal Scorer</Label>
                <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal scorer" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchState.squad.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.first_name} {player.last_name}
                        {player.jersey_number && ` (#${player.jersey_number})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {eventDialog.type === 'goal' && eventDialog.isOurTeam && (
              <div>
                <Label>Assist (Optional)</Label>
                <Select value={selectedAssist} onValueChange={setSelectedAssist}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assist player (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No assist</SelectItem>
                    {matchState.squad
                      .filter(player => player.id !== selectedPlayer)
                      .map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.first_name} {player.last_name}
                          {player.jersey_number && ` (#${player.jersey_number})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {eventDialog.type === 'goal' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="penalty"
                  checked={isPenalty}
                  onCheckedChange={(checked) => setIsPenalty(checked as boolean)}
                />
                <Label htmlFor="penalty">Penalty goal</Label>
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button onClick={addEvent} className="flex-1">
                Add Event
              </Button>
              <Button variant="outline" onClick={closeEventDialog} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={substitutionDialog.open} onOpenChange={(open) => setSubstitutionDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Substitution</DialogTitle>
            <DialogDescription>
              Select the player coming off and the player coming on at minute {getCurrentMinute()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Player Coming Off</Label>
              <Select value={substitutionDialog.playerOff} onValueChange={(value) => setSubstitutionDialog(prev => ({ ...prev, playerOff: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player to substitute off" />
                </SelectTrigger>
                <SelectContent>
                  {gameState.playerTimes
                    .filter(pt => pt.time_on !== null && pt.time_off === null)
                    .map((pt) => {
                      const player = matchState.squad.find(p => p.id === pt.player_id);
                      return (
                        <SelectItem key={pt.player_id} value={pt.player_id}>
                          {player?.first_name} {player?.last_name}
                          {player?.jersey_number && ` (#${player.jersey_number})`}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Player Coming On</Label>
              <Select value={substitutionDialog.playerOn} onValueChange={(value) => setSubstitutionDialog(prev => ({ ...prev, playerOn: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player to bring on" />
                </SelectTrigger>
                <SelectContent>
                  {gameState.playerTimes
                    .filter(pt => pt.time_on === null || pt.time_off !== null)
                    .map((pt) => {
                      const player = matchState.squad.find(p => p.id === pt.player_id);
                      return (
                        <SelectItem key={pt.player_id} value={pt.player_id}>
                          {player?.first_name} {player?.last_name}
                          {player?.jersey_number && ` (#${player.jersey_number})`}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => {
                  if (substitutionDialog.playerOff && substitutionDialog.playerOn) {
                    makeSubstitution(substitutionDialog.playerOn, substitutionDialog.playerOff);
                    setSubstitutionDialog({ open: false, playerOff: '', playerOn: '' });
                  }
                }}
                disabled={!substitutionDialog.playerOff || !substitutionDialog.playerOn}
                className="flex-1"
              >
                Make Substitution
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSubstitutionDialog({ open: false, playerOff: '', playerOn: '' })}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}