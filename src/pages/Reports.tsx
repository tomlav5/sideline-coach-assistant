import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Trophy, Calendar, Target, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveWrapper } from '@/components/ui/responsive-wrapper';

interface CompletedMatch {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string;
  our_score: number;
  opponent_score: number;
  team_name: string;
}

interface GoalScorer {
  player_id: string;
  player_name: string;
  goals: number;
  assists: number;
  team_name: string;
}

interface PlayerPlayingTime {
  player_id: string;
  player_name: string;
  total_minutes: number;
  matches_played: number;
  average_minutes: number;
  team_name: string;
}

export default function Reports() {
  const [completedMatches, setCompletedMatches] = useState<CompletedMatch[]>([]);
  const [goalScorers, setGoalScorers] = useState<GoalScorer[]>([]);
  const [playingTime, setPlayingTime] = useState<PlayerPlayingTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [competitionFilter, setCompetitionFilter] = useState<string>('all');
  const [competitions, setCompetitions] = useState<{ type: string; name?: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompetitions();
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [competitionFilter]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Build competition filter condition
      let competitionCondition = {};
      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          competitionCondition = { competition_type: type };
        } else if (competitionFilter.startsWith('name:')) {
          const name = competitionFilter.replace('name:', '');
          competitionCondition = { competition_name: name };
        }
      }
      
      // Fetch completed matches with scores
      const { data: fixtures, error: fixturesError } = await supabase
        .from('fixtures')
        .select(`
          id,
          scheduled_date,
          opponent_name,
          location,
          competition_type,
          competition_name,
          teams!fk_fixtures_team_id (name)
        `)
        .eq('status', 'completed')
        .match(competitionCondition)
        .order('scheduled_date', { ascending: false });

      if (fixturesError) throw fixturesError;

      // For each completed match, calculate the score
      const matchesWithScores = await Promise.all(
        (fixtures || []).map(async (fixture) => {
          // Get our goals
          const { data: ourGoals } = await supabase
            .from('match_events')
            .select('id')
            .eq('fixture_id', fixture.id)
            .eq('event_type', 'goal')
            .eq('is_our_team', true);

          // Get opponent goals
          const { data: opponentGoals } = await supabase
            .from('match_events')
            .select('id')
            .eq('fixture_id', fixture.id)
            .eq('event_type', 'goal')
            .eq('is_our_team', false);

          return {
            id: fixture.id,
            scheduled_date: fixture.scheduled_date,
            opponent_name: fixture.opponent_name,
            location: fixture.location || 'TBC',
            our_score: ourGoals?.length || 0,
            opponent_score: opponentGoals?.length || 0,
            team_name: fixture.teams?.name || 'Unknown Team'
          };
        })
      );

      setCompletedMatches(matchesWithScores);

      // Fetch goal scorers data with competition filter
      const goalEventsQuery = supabase
        .from('match_events')
        .select(`
          player_id,
          event_type,
          fixtures!fk_match_events_fixture_id (
            status,
            competition_type,
            competition_name,
            teams!fk_fixtures_team_id (name)
          ),
          players!fk_match_events_player_id (
            first_name,
            last_name
          )
        `)
        .eq('is_our_team', true)
        .eq('fixtures.status', 'completed')
        .in('event_type', ['goal', 'assist']);

      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          goalEventsQuery.eq('fixtures.competition_type', type as 'league' | 'tournament' | 'friendly');
        } else if (competitionFilter.startsWith('name:')) {
          const name = competitionFilter.replace('name:', '');
          goalEventsQuery.eq('fixtures.competition_name', name);
        }
      }

      const { data: goalEvents, error: goalError } = await goalEventsQuery;

      if (goalError) throw goalError;

      // Process goal scorers
      const scorersMap = new Map<string, GoalScorer>();
      
      (goalEvents || []).forEach((event) => {
        if (!event.player_id || !event.players) return;
        
        const playerId = event.player_id;
        const playerName = `${event.players.first_name} ${event.players.last_name}`;
        const teamName = event.fixtures?.teams?.name || 'Unknown Team';
        
        if (!scorersMap.has(playerId)) {
          scorersMap.set(playerId, {
            player_id: playerId,
            player_name: playerName,
            goals: 0,
            assists: 0,
            team_name: teamName
          });
        }
        
        const scorer = scorersMap.get(playerId)!;
        if (event.event_type === 'goal') {
          scorer.goals++;
        } else if (event.event_type === 'assist') {
          scorer.assists++;
        }
      });

      const sortedScorers = Array.from(scorersMap.values())
        .sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.assists - a.assists;
        });

      setGoalScorers(sortedScorers);

      // Fetch playing time data
      const playingTimeQuery = supabase
        .from('player_time_logs')
        .select(`
          player_id,
          fixture_id,
          total_minutes,
          fixtures!fk_player_time_logs_fixture_id (
            status,
            competition_type,
            competition_name,
            teams!fk_fixtures_team_id (name)
          ),
          players!fk_player_time_logs_player_id (
            first_name,
            last_name
          )
        `)
        .eq('fixtures.status', 'completed');

      if (competitionFilter !== 'all') {
        if (competitionFilter.startsWith('type:')) {
          const type = competitionFilter.replace('type:', '');
          playingTimeQuery.eq('fixtures.competition_type', type as 'league' | 'tournament' | 'friendly');
        } else if (competitionFilter.startsWith('name:')) {
          const name = competitionFilter.replace('name:', '');
          playingTimeQuery.eq('fixtures.competition_name', name);
        }
      }

      const { data: playingTimeData, error: playingTimeError } = await playingTimeQuery;

      if (playingTimeError) throw playingTimeError;

      // Process playing time data - aggregate by player and match
      const playerMatchMap = new Map<string, Map<string, number>>(); // playerId -> matchId -> totalMinutes
      const playingTimeMap = new Map<string, PlayerPlayingTime>();
      
      (playingTimeData || []).forEach((record) => {
        if (!record.player_id || !record.players) return;
        
        const playerId = record.player_id;
        const playerName = `${record.players.first_name} ${record.players.last_name}`;
        const teamName = record.fixtures?.teams?.name || 'Unknown Team';
        const fixtureId = record.fixture_id || 'unknown';
        
        // Initialize player match tracking
        if (!playerMatchMap.has(playerId)) {
          playerMatchMap.set(playerId, new Map());
        }
        
        // Initialize player stats
        if (!playingTimeMap.has(playerId)) {
          playingTimeMap.set(playerId, {
            player_id: playerId,
            player_name: playerName,
            total_minutes: 0,
            matches_played: 0,
            average_minutes: 0,
            team_name: teamName
          });
        }
        
        const playerMatches = playerMatchMap.get(playerId)!;
        const currentMatchMinutes = playerMatches.get(fixtureId) || 0;
        playerMatches.set(fixtureId, currentMatchMinutes + (record.total_minutes || 0));
      });

      // Calculate totals from aggregated match data
      playerMatchMap.forEach((matches, playerId) => {
        const playerStats = playingTimeMap.get(playerId)!;
        let totalMinutes = 0;
        
        matches.forEach((minutes) => {
          totalMinutes += minutes;
        });
        
        playerStats.total_minutes = totalMinutes;
        playerStats.matches_played = matches.size; // Number of different matches
      });

      // Calculate averages and sort
      const sortedPlayingTime = Array.from(playingTimeMap.values())
        .map(player => ({
          ...player,
          average_minutes: player.matches_played > 0 ? Math.round(player.total_minutes / player.matches_played) : 0
        }))
        .sort((a, b) => b.total_minutes - a.total_minutes);

      setPlayingTime(sortedPlayingTime);

    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('fixtures')
        .select('competition_type, competition_name')
        .eq('status', 'completed');

      if (error) throw error;

      const competitionsSet = new Set<string>();
      (data || []).forEach(fixture => {
        if (fixture.competition_type) {
          competitionsSet.add(`type:${fixture.competition_type}`);
        }
        if (fixture.competition_name) {
          competitionsSet.add(`name:${fixture.competition_name}`);
        }
      });

      const competitionsList = Array.from(competitionsSet).map(comp => {
        if (comp.startsWith('type:')) {
          return { type: comp.replace('type:', '') };
        } else {
          return { type: 'tournament', name: comp.replace('name:', '') };
        }
      });

      setCompetitions(competitionsList);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  };

  const getMatchResult = (ourScore: number, opponentScore: number) => {
    if (ourScore > opponentScore) return { result: 'W', color: 'bg-green-500' };
    if (ourScore < opponentScore) return { result: 'L', color: 'bg-red-500' };
    return { result: 'D', color: 'bg-yellow-500' };
  };

  const deleteMatch = async (matchId: string) => {
    try {
      // Delete all related data in the correct order (due to foreign key constraints)
      
      // Delete player time logs
      const { error: timeLogsError } = await supabase
        .from('player_time_logs')
        .delete()
        .eq('fixture_id', matchId);

      if (timeLogsError) throw timeLogsError;

      // Delete match events (goals, assists, etc.)
      const { error: eventsError } = await supabase
        .from('match_events')
        .delete()
        .eq('fixture_id', matchId);

      if (eventsError) throw eventsError;

      // Finally delete the fixture
      const { error: fixtureError } = await supabase
        .from('fixtures')
        .delete()
        .eq('id', matchId);

      if (fixtureError) throw fixtureError;

      toast({
        title: "Match deleted",
        description: "The match and all associated data have been removed",
      });

      // Refresh the data
      fetchReportsData();
    } catch (error) {
      console.error('Error deleting match:', error);
      toast({
        title: "Error",
        description: "Failed to delete match",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <ResponsiveWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading reports...</div>
        </div>
      </ResponsiveWrapper>
    );
  }

  return (
    <ResponsiveWrapper className="space-y-6 max-w-full">
      <div className="flex items-center space-x-2">
        <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
      </div>

      {/* Competition Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <Label htmlFor="competition-filter" className="text-base font-medium min-w-fit">Filter by Competition:</Label>
            <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
              <SelectTrigger className="w-full sm:w-64 min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competitions</SelectItem>
                <SelectItem value="type:league">League Matches Only</SelectItem>
                <SelectItem value="type:tournament">Tournament Matches Only</SelectItem>
                <SelectItem value="type:friendly">Friendly Matches Only</SelectItem>
                {competitions.map((comp, index) => (
                  comp.name && (
                    <SelectItem key={index} value={`name:${comp.name}`}>
                      {comp.name}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="matches" className="space-y-6 w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="matches" className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 p-2 sm:p-3 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span>Matches</span>
          </TabsTrigger>
          <TabsTrigger value="scorers" className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 p-2 sm:p-3 text-xs sm:text-sm">
            <Target className="h-4 w-4" />
            <span>Scorers</span>
          </TabsTrigger>
          <TabsTrigger value="playing-time" className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 p-2 sm:p-3 text-xs sm:text-sm">
            <Clock className="h-4 w-4" />
            <span>Time</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-6">
          {/* Last 5 Results Summary */}
          {completedMatches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Form</CardTitle>
                <CardDescription>Last 5 match results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center space-x-2">
                  {completedMatches.slice(0, 5).map((match, index) => {
                    const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                    return (
                      <div
                        key={match.id}
                        className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm`}
                        title={`${match.team_name} ${match.our_score}-${match.opponent_score} ${match.opponent_name}`}
                      >
                        {result}
                      </div>
                    );
                  })}
                  {completedMatches.length < 5 && (
                    <span className="text-muted-foreground text-sm ml-4">
                      {5 - completedMatches.length} more matches needed for full form
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Completed Matches</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {completedMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed matches found
                </div>
              ) : (
                <div className="space-y-3 p-4 sm:p-0">
                  {completedMatches.map((match) => {
                    const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                    return (
                      <Card key={match.id} className="sm:hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(match.scheduled_date), 'dd/MM/yyyy')}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={`${color} text-white text-xs`}>
                                {result}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                    View Report
                                  </DropdownMenuItem>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Match
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Match Record</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this match? This action cannot be undone and will permanently remove:
                                          <br />• Match details and score
                                          <br />• All goals and assists
                                          <br />• Player playing time records
                                          <br />• All other match events
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Delete Match
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm truncate pr-2">{match.team_name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-lg">{match.our_score}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm truncate pr-2">{match.opponent_name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-lg">{match.opponent_score}</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground pt-2 border-t">
                              {match.location}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* Desktop Table - Hidden on mobile */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse">
                       <thead>
                         <tr className="border-b">
                           <th className="text-left p-3 text-sm font-medium">Date</th>
                           <th className="text-left p-3 text-sm font-medium">Team</th>
                           <th className="text-left p-3 text-sm font-medium">Opponent</th>
                           <th className="text-center p-3 text-sm font-medium">Score</th>
                           <th className="text-center p-3 text-sm font-medium">Result</th>
                           <th className="text-left p-3 text-sm font-medium">Location</th>
                           <th className="text-center p-3 text-sm font-medium">Actions</th>
                         </tr>
                       </thead>
                      <tbody>
                         {completedMatches.map((match) => {
                           const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                           return (
                             <tr key={match.id} className="border-b hover:bg-muted/50">
                               <td className="p-3 text-sm cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                 {format(new Date(match.scheduled_date), 'dd/MM/yyyy')}
                               </td>
                               <td className="p-3 font-medium text-sm cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                 {match.team_name}
                               </td>
                               <td className="p-3 text-sm cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>{match.opponent_name}</td>
                               <td className="p-3 text-center font-mono text-lg cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                 {match.our_score} - {match.opponent_score}
                               </td>
                               <td className="p-3 text-center cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                 <Badge className={`${color} text-white text-xs`}>
                                   {result}
                                 </Badge>
                               </td>
                               <td className="p-3 text-muted-foreground text-sm cursor-pointer" onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                 {match.location}
                               </td>
                               <td className="p-3 text-center">
                                 <DropdownMenu>
                                   <DropdownMenuTrigger asChild>
                                     <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                       <MoreVertical className="h-4 w-4" />
                                     </Button>
                                   </DropdownMenuTrigger>
                                   <DropdownMenuContent align="end">
                                     <DropdownMenuItem onClick={() => window.open(`/match-report/${match.id}`, '_blank')}>
                                       View Report
                                     </DropdownMenuItem>
                                     <AlertDialog>
                                       <AlertDialogTrigger asChild>
                                         <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                           <Trash2 className="h-4 w-4 mr-2" />
                                           Delete Match
                                         </DropdownMenuItem>
                                       </AlertDialogTrigger>
                                       <AlertDialogContent>
                                         <AlertDialogHeader>
                                           <AlertDialogTitle>Delete Match Record</AlertDialogTitle>
                                           <AlertDialogDescription>
                                             Are you sure you want to delete this match? This action cannot be undone and will permanently remove:
                                             <br />• Match details and score
                                             <br />• All goals and assists
                                             <br />• Player playing time records
                                             <br />• All other match events
                                           </AlertDialogDescription>
                                         </AlertDialogHeader>
                                         <AlertDialogFooter>
                                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                                           <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                             Delete Match
                                           </AlertDialogAction>
                                         </AlertDialogFooter>
                                       </AlertDialogContent>
                                     </AlertDialog>
                                   </DropdownMenuContent>
                                 </DropdownMenu>
                               </td>
                             </tr>
                           );
                         })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scorers">
          <Card>
            <CardHeader>
              <CardTitle>Goal Scorer League Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {goalScorers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No goal scorer data available
                </div>
              ) : (
                <div className="space-y-3 p-4 sm:p-0">
                  {goalScorers.map((scorer, index) => (
                    <Card key={scorer.player_id} className="sm:hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center">
                              {index === 0 && (
                                <Trophy className="h-4 w-4 text-yellow-500 mr-1" />
                              )}
                              <span className="font-medium text-sm">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-medium text-sm">{scorer.player_name}</div>
                              <div className="text-xs text-muted-foreground">{scorer.team_name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{scorer.goals + scorer.assists}</div>
                            <div className="text-xs text-muted-foreground">
                              {scorer.goals}G {scorer.assists}A
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 w-16 text-sm font-medium">Rank</th>
                          <th className="text-left p-3 text-sm font-medium">Player</th>
                          <th className="text-left p-3 text-sm font-medium">Team</th>
                          <th className="text-center p-3 text-sm font-medium">Goals</th>
                          <th className="text-center p-3 text-sm font-medium">Assists</th>
                          <th className="text-center p-3 text-sm font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goalScorers.map((scorer, index) => (
                          <tr key={scorer.player_id} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">
                              {index === 0 && (
                                <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />
                              )}
                              #{index + 1}
                            </td>
                            <td className="p-3 font-medium text-sm">
                              {scorer.player_name}
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">
                              {scorer.team_name}
                            </td>
                            <td className="p-3 text-center text-lg font-bold">
                              {scorer.goals}
                            </td>
                            <td className="p-3 text-center text-lg font-bold">
                              {scorer.assists}
                            </td>
                            <td className="p-3 text-center text-lg font-bold">
                              {scorer.goals + scorer.assists}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playing-time">
          <Card>
            <CardHeader>
              <CardTitle>Player Playing Time</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {playingTime.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No playing time data available
                </div>
              ) : (
                <div className="space-y-3 p-4 sm:p-0">
                  {playingTime.map((player) => (
                    <Card key={player.player_id} className="sm:hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{player.player_name}</div>
                            <div className="text-xs text-muted-foreground">{player.team_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatMinutes(player.total_minutes)}</div>
                            <div className="text-xs text-muted-foreground">
                              {player.matches_played} matches • {formatMinutes(player.average_minutes)} avg
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 text-sm font-medium">Player</th>
                          <th className="text-left p-3 text-sm font-medium">Team</th>
                          <th className="text-center p-3 text-sm font-medium">Total Minutes</th>
                          <th className="text-center p-3 text-sm font-medium">Matches Played</th>
                          <th className="text-center p-3 text-sm font-medium">Average Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playingTime.map((player) => (
                          <tr key={player.player_id} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium text-sm">
                              {player.player_name}
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">
                              {player.team_name}
                            </td>
                            <td className="p-3 text-center font-bold">
                              {formatMinutes(player.total_minutes)}
                            </td>
                            <td className="p-3 text-center">
                              {player.matches_played}
                            </td>
                            <td className="p-3 text-center">
                              {formatMinutes(player.average_minutes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ResponsiveWrapper>
  );
}