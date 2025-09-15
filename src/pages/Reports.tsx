import { useState } from 'react';
import { useCompletedMatches, useGoalScorers, usePlayerPlayingTime, useCompetitions } from '@/hooks/useReports';
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
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExportDialog } from '@/components/reports/ExportDialog';

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
  const [competitionFilter, setCompetitionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'matches' | 'scorers' | 'playing-time'>('matches');
  const { data: completedMatches = [], isLoading: matchesLoading } = useCompletedMatches(competitionFilter, { enabled: activeTab === 'matches' });
  const { data: goalScorers = [], isLoading: scorersLoading } = useGoalScorers(competitionFilter, { enabled: activeTab === 'scorers' });
  const { data: playingTime = [], isLoading: timeLoading } = usePlayerPlayingTime(competitionFilter, { enabled: activeTab === 'playing-time' });
  const { data: competitions = [] } = useCompetitions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getMatchResult = (ourScore: number, opponentScore: number) => {
    if (ourScore > opponentScore) return { result: 'W', color: 'bg-green-500' };
    if (ourScore < opponentScore) return { result: 'L', color: 'bg-red-500' };
    return { result: 'D', color: 'bg-yellow-500' };
  };

  const deleteMatch = async (matchId: string) => {
    try {
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

      // Refresh the data and invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['live-match-detection'] });
      queryClient.invalidateQueries({ queryKey: ['live-match-check'] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (error) {
      console.error('Error deleting match:', error);
      toast({
        title: "Error",
        description: "Failed to delete match",
        variant: "destructive",
      });
    }
  };

  const isLoading = activeTab === 'matches' ? matchesLoading : activeTab === 'scorers' ? scorersLoading : timeLoading;

  if (isLoading) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
        </div>
        <ExportDialog competitionFilter={competitionFilter} />
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
                    <SelectItem key={index} value={comp.type}>
                      {comp.name}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'matches' | 'scorers' | 'playing-time')} className="space-y-6 w-full">
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
                    <div className="text-sm text-muted-foreground ml-4">
                      {5 - completedMatches.length} more matches needed for full form
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Matches */}
          <Card>
            <CardHeader>
              <CardTitle>Completed Matches</CardTitle>
            </CardHeader>
            <CardContent>
              {completedMatches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No completed matches found
                </p>
              ) : (
                <div className="space-y-3">
                  {completedMatches.map((match) => {
                    const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                    return (
                      <div key={match.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm`}>
                            {result}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium">{match.team_name}</span>
                              <span className="text-lg font-mono">{match.our_score} - {match.opponent_score}</span>
                              <span className="font-medium">{match.opponent_name}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(match.scheduled_date), 'dd/MM/yyyy HH:mm')} • {match.location}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={`/match-report/${match.id}`}>
                                View Report
                              </a>
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
                                  <AlertDialogTitle>Delete Match</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this match? This will permanently remove all match data including events, player times, and statistics. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMatch(match.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Match
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scorers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Goal Scorers</CardTitle>
              <CardDescription>Top performers in goals and assists</CardDescription>
            </CardHeader>
            <CardContent>
              {goalScorers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No goal scorers found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Player</th>
                        <th className="pb-2 font-medium">Team</th>
                        <th className="pb-2 font-medium text-center">Goals</th>
                        <th className="pb-2 font-medium text-center">Assists</th>
                        <th className="pb-2 font-medium text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goalScorers.map((player) => (
                        <tr key={player.player_id} className="border-b">
                          <td className="py-2 font-medium">{player.player_name}</td>
                          <td className="py-2 text-muted-foreground">{player.team_name}</td>
                          <td className="py-2 text-center">
                            <Badge variant="secondary">{player.goals}</Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge variant="outline">{player.assists}</Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge variant="default">{player.goals + player.assists}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playing-time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Player Performance</CardTitle>
              <CardDescription>Total playing time across all matches</CardDescription>
            </CardHeader>
            <CardContent>
              {playingTime.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No playing time data found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Player</th>
                        <th className="pb-2 font-medium">Team</th>
                        <th className="pb-2 font-medium text-center">Matches</th>
                        <th className="pb-2 font-medium text-center">Total Time</th>
                        <th className="pb-2 font-medium text-center">Avg per Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playingTime.map((player) => (
                        <tr key={player.player_id} className="border-b">
                          <td className="py-2 font-medium">{player.player_name}</td>
                          <td className="py-2 text-muted-foreground">{player.team_name}</td>
                          <td className="py-2 text-center">
                            <Badge variant="secondary">{player.matches_played}</Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge variant="outline">{formatMinutes(player.total_minutes)}</Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge variant="default">{formatMinutes(player.average_minutes)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ResponsiveWrapper>
  );
}