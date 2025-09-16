import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trophy, Calendar, Target, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveWrapper } from '@/components/ui/responsive-wrapper';
import { useCompletedMatches, useGoalScorers, usePlayerPlayingTime, useCompetitions } from '@/hooks/useReports';
import { useReportRefresh } from '@/hooks/useReportRefresh';

export default function OptimizedReports() {
  const [competitionFilter, setCompetitionFilter] = useState<string>('all');
  
  // Use optimized materialized view queries
  const { data: completedMatches = [], isLoading: matchesLoading } = useCompletedMatches(competitionFilter);
  const { data: goalScorers = [], isLoading: scorersLoading } = useGoalScorers(competitionFilter);
  const { data: playingTime = [], isLoading: timeLoading } = usePlayerPlayingTime(competitionFilter);
  const { data: competitions = [] } = useCompetitions();
  
  // Enable automatic report refresh when data changes
  useReportRefresh();
  
  const reportsLoading = matchesLoading || scorersLoading || timeLoading;

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

  if (reportsLoading) {
    return (
      <ResponsiveWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="text-lg">Loading optimized reports...</div>
            <div className="text-sm text-muted-foreground">Using high-performance materialized views</div>
          </div>
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
                      <Card key={match.id} className="sm:hidden cursor-pointer hover:bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(match.scheduled_date), 'dd/MM/yyyy')}
                            </div>
                            <Badge className={`${color} text-white text-xs`}>
                              {result}
                            </Badge>
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
                          </div>
                        </CardContent>
                      </Card>
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
              <CardTitle>Goal Scorers & Assists</CardTitle>
            </CardHeader>
            <CardContent>
              {goalScorers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No goal scorers found
                </div>
              ) : (
                <div className="space-y-3">
                  {goalScorers.map((scorer, index) => (
                    <div key={scorer.player_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{scorer.player_name}</div>
                          <div className="text-sm text-muted-foreground">Team</div>
                        </div>
                      </div>
                      <div className="flex space-x-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-lg">{scorer.goals}</div>
                          <div className="text-muted-foreground">Goals</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{scorer.assists}</div>
                          <div className="text-muted-foreground">Assists</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playing-time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Player Playing Time</CardTitle>
            </CardHeader>
            <CardContent>
              {playingTime.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No playing time data found
                </div>
              ) : (
                <div className="space-y-3">
                  {playingTime.map((player, index) => (
                    <div key={player.player_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{player.player_name}</div>
                          <div className="text-sm text-muted-foreground">Team</div>
                        </div>
                      </div>
                      <div className="flex space-x-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-lg">{formatMinutes(player.total_minutes)}</div>
                          <div className="text-muted-foreground">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{player.matches_played}</div>
                          <div className="text-muted-foreground">Matches</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-lg">{formatMinutes(Math.round(player.total_minutes / player.matches_played))}</div>
                          <div className="text-muted-foreground">Avg</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ResponsiveWrapper>
  );
}