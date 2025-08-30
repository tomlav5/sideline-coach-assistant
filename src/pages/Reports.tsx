import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trophy, Calendar, Target, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
          teams (name)
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
          fixtures!inner (
            status,
            competition_type,
            competition_name,
            teams (name)
          ),
          players (
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
          total_minutes,
          fixtures!inner (
            status,
            competition_type,
            competition_name,
            teams (name)
          ),
          players (
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

      // Process playing time data
      const playingTimeMap = new Map<string, PlayerPlayingTime>();
      
      (playingTimeData || []).forEach((record) => {
        if (!record.player_id || !record.players) return;
        
        const playerId = record.player_id;
        const playerName = `${record.players.first_name} ${record.players.last_name}`;
        const teamName = record.fixtures?.teams?.name || 'Unknown Team';
        
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
        
        const playerStats = playingTimeMap.get(playerId)!;
        playerStats.total_minutes += record.total_minutes || 0;
        playerStats.matches_played += 1;
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Trophy className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Reports</h1>
      </div>

      {/* Competition Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <Label htmlFor="competition-filter">Filter by Competition:</Label>
            <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
              <SelectTrigger className="w-64">
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

      <Tabs defaultValue="matches" className="space-y-6">
        <TabsList>
          <TabsTrigger value="matches" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Match Results</span>
          </TabsTrigger>
          <TabsTrigger value="scorers" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Goal Scorers</span>
          </TabsTrigger>
          <TabsTrigger value="playing-time" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Playing Time</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          <Card>
            <CardHeader>
              <CardTitle>Completed Matches</CardTitle>
            </CardHeader>
            <CardContent>
              {completedMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed matches found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Opponent</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedMatches.map((match) => {
                      const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                      return (
                        <TableRow key={match.id}>
                          <TableCell>
                            {format(new Date(match.scheduled_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {match.team_name}
                          </TableCell>
                          <TableCell>{match.opponent_name}</TableCell>
                          <TableCell className="font-mono text-lg">
                            {match.our_score} - {match.opponent_score}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${color} text-white`}>
                              {result}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {match.location}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scorers">
          <Card>
            <CardHeader>
              <CardTitle>Goal Scorer League Table</CardTitle>
            </CardHeader>
            <CardContent>
              {goalScorers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No goal scorer data available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Goals</TableHead>
                      <TableHead className="text-center">Assists</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goalScorers.map((scorer, index) => (
                      <TableRow key={scorer.player_id}>
                        <TableCell className="font-medium">
                          {index === 0 && (
                            <Trophy className="h-4 w-4 text-yellow-500 inline mr-1" />
                          )}
                          #{index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {scorer.player_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {scorer.team_name}
                        </TableCell>
                        <TableCell className="text-center font-mono text-lg">
                          {scorer.goals}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {scorer.assists}
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">
                          {scorer.goals + scorer.assists}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playing-time">
          <Card>
            <CardHeader>
              <CardTitle>Player Playing Time</CardTitle>
            </CardHeader>
            <CardContent>
              {playingTime.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No playing time data available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Total Time</TableHead>
                      <TableHead className="text-center">Matches</TableHead>
                      <TableHead className="text-center">Average</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playingTime.map((player, index) => (
                      <TableRow key={player.player_id}>
                        <TableCell className="font-medium">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {player.player_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.team_name}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {formatMinutes(player.total_minutes)}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {player.matches_played}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {formatMinutes(player.average_minutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}