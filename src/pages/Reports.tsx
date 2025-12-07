import { useState, useMemo, useCallback } from 'react';
import { useCompletedMatches, useGoalScorers, usePlayerPlayingTime, useCompetitions } from '@/hooks/useReports';
import { useReportRefresh } from '@/hooks/useReportRefresh';
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
import { VirtualList } from '@/components/ui/virtual-list';
import { MatchItem } from '@/components/reports/MatchItem';
import { ScorerItem } from '@/components/reports/ScorerItem';
import { PlayingTimeItem } from '@/components/reports/PlayingTimeItem';
import { TimeDebugPanel } from '@/components/reports/TimeDebugPanel';

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
  const [activeTab, setActiveTab] = useState<'matches' | 'scorers' | 'playing-time' | 'dev-time'>('matches');
  
  // Use optimized hooks with pagination (show 50 items per page for better performance)
  const { data: completedMatches = [], isLoading: matchesLoading } = useCompletedMatches(competitionFilter, { 
    enabled: activeTab === 'matches',
    limit: 50
  });
  const { data: goalScorers = [], isLoading: scorersLoading } = useGoalScorers(competitionFilter, { 
    enabled: activeTab === 'scorers',
    limit: 50
  });
  const { data: playingTime = [], isLoading: timeLoading } = usePlayerPlayingTime(competitionFilter, { 
    enabled: activeTab === 'playing-time',
    limit: 50
  });
  const { data: competitions = [] } = useCompetitions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable automatic report refresh when data changes
  useReportRefresh();

  // Memoized utility functions for better performance
  const formatMinutes = useCallback((minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, []);

  const getMatchResult = useCallback((ourScore: number, opponentScore: number) => {
    if (ourScore > opponentScore) return { result: 'W', color: 'bg-green-500' };
    if (ourScore < opponentScore) return { result: 'L', color: 'bg-red-500' };
    return { result: 'D', color: 'bg-yellow-500' };
  }, []);

  // Memoized delete function with optimized cache invalidation
  const deleteMatch = useCallback(async (matchId: string) => {
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

      // Optimized cache invalidation - only invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['goal-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['player-playing-time'] });
      // Don't invalidate all queries - be more targeted
      queryClient.invalidateQueries({ queryKey: ['fixtures'], exact: false });
    } catch (error) {
      console.error('Error deleting match:', error);
      toast({
        title: "Error",
        description: "Failed to delete match",
        variant: "destructive",
      });
    }
  }, [toast, queryClient]);

  // Memoized recent form calculation
  const recentForm = useMemo(() => {
    return completedMatches.slice(0, 5);
  }, [completedMatches]);

  // Memoized loading state
  const isLoading = useMemo(() => {
    return activeTab === 'matches' ? matchesLoading : 
           activeTab === 'scorers' ? scorersLoading : 
           timeLoading;
  }, [activeTab, matchesLoading, scorersLoading, timeLoading]);

  if (isLoading) {
    return (
      <ResponsiveWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="text-lg">Loading optimized reports...</div>
            <div className="text-sm text-muted-foreground">Using high-performance data views</div>
          </div>
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
                  comp.display_name && (
                    <SelectItem key={index} value={comp.filter_value}>
                      {comp.display_name}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6 w-full">
        <TabsList className={`grid w-full h-auto ${import.meta.env.MODE !== 'production' ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
          {import.meta.env.MODE !== 'production' && (
            <TabsTrigger value="dev-time" className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-2 p-2 sm:p-3 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              <span>Dev: Time Debug</span>
            </TabsTrigger>
          )}
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
                <div className="space-y-2 sm:space-y-3">
                  {completedMatches.map((match) => {
                    const { result, color } = getMatchResult(match.our_score, match.opponent_score);
                    return (
                      <div key={match.id} className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-2">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${color} text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0`}>
                            {result}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-1">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-medium text-sm sm:text-base truncate max-w-[80px] sm:max-w-none">{match.team_name}</span>
                                <span className="text-base sm:text-lg font-mono font-semibold whitespace-nowrap text-primary">{match.our_score} - {match.opponent_score}</span>
                                <span className="font-medium text-sm sm:text-base truncate max-w-[80px] sm:max-w-none">{match.opponent_name}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
                              <span className="whitespace-nowrap">{format(new Date(match.scheduled_date), 'dd MMM yyyy')}</span>
                              {match.location && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="truncate max-w-[100px] sm:max-w-none">{match.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
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
                                    className="bg-destructive hover:bg-destructive/90"
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
          {/* Goals Table */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Top Goal Scorers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {goalScorers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No goal scorers found</p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[280px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pl-3 sm:pl-0 font-medium text-xs sm:text-sm">Player</th>
                        <th className="pb-2 font-medium text-xs sm:text-sm hidden sm:table-cell">Team</th>
                        <th className="pb-2 pr-3 sm:pr-0 font-medium text-center text-xs sm:text-sm">Goals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...goalScorers]
                        .sort((a, b) => (b.goals || 0) - (a.goals || 0))
                        .map((player) => (
                          <tr key={`goals-${player.player_id}`} className="border-b">
                            <td className="py-2.5 pl-3 sm:pl-0">
                              <div className="font-medium text-sm">{player.player_name}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">{player.team_name}</div>
                            </td>
                            <td className="py-2.5 text-muted-foreground text-sm hidden sm:table-cell">{player.team_name}</td>
                            <td className="py-2.5 pr-3 sm:pr-0 text-center">
                              <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-2.5">{player.goals}</Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assists Table */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Top Assist Providers</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {goalScorers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No assists found</p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[280px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pl-3 sm:pl-0 font-medium text-xs sm:text-sm">Player</th>
                        <th className="pb-2 font-medium text-xs sm:text-sm hidden sm:table-cell">Team</th>
                        <th className="pb-2 pr-3 sm:pr-0 font-medium text-center text-xs sm:text-sm">Assists</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...goalScorers]
                        .filter(p => (p.assists || 0) > 0)
                        .sort((a, b) => (b.assists || 0) - (a.assists || 0))
                        .map((player) => (
                          <tr key={`assists-${player.player_id}`} className="border-b">
                            <td className="py-2.5 pl-3 sm:pl-0">
                              <div className="font-medium text-sm">{player.player_name}</div>
                              <div className="text-xs text-muted-foreground sm:hidden">{player.team_name}</div>
                            </td>
                            <td className="py-2.5 text-muted-foreground text-sm hidden sm:table-cell">{player.team_name}</td>
                            <td className="py-2.5 pr-3 sm:pr-0 text-center">
                              <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-2.5">{player.assists}</Badge>
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

        {import.meta.env.MODE !== 'production' && (
          <TabsContent value="dev-time" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Developer: Playing Time Debug</CardTitle>
                <CardDescription>Inspect raw player time logs vs computed totals and export CSV.</CardDescription>
              </CardHeader>
              <CardContent>
                <TimeDebugPanel />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </ResponsiveWrapper>
  );
}