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
import { Trophy, Calendar, Target } from 'lucide-react';
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

export default function Reports() {
  const [completedMatches, setCompletedMatches] = useState<CompletedMatch[]>([]);
  const [goalScorers, setGoalScorers] = useState<GoalScorer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Fetch completed matches with scores
      const { data: fixtures, error: fixturesError } = await supabase
        .from('fixtures')
        .select(`
          id,
          scheduled_date,
          opponent_name,
          location,
          teams (name)
        `)
        .eq('status', 'completed')
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

      // Fetch goal scorers data
      const { data: goalEvents, error: goalError } = await supabase
        .from('match_events')
        .select(`
          player_id,
          event_type,
          fixtures!inner (
            status,
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
      </Tabs>
    </div>
  );
}