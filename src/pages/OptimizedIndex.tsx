import { memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedDashboardStats } from '@/hooks/useOptimizedDashboard';
import { useLiveMatchDetection } from '@/hooks/useLiveMatchDetection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Play, BarChart3, Settings2 } from 'lucide-react';
import { QuickStatsCard } from '@/components/dashboard/QuickStatsCard';
import { QuickActionCard } from '@/components/dashboard/QuickActionCard';
import { LiveMatchBanner } from '@/components/dashboard/LiveMatchBanner';

const OptimizedIndex = memo(() => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useOptimizedDashboardStats();
  const { data: liveMatchData } = useLiveMatchDetection();
  
  // Extract first name from user profile or metadata
  const firstName = useMemo(() => 
    user?.user_metadata?.first_name || 
    user?.email?.split('@')[0] || 
    'Coach'
  , [user]);

  // Memoized navigation handlers
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleResumeMatch = useCallback(() => {
    if (liveMatchData?.liveMatchId) {
      navigate(`/match-day/${liveMatchData.liveMatchId}`);
    }
  }, [navigate, liveMatchData?.liveMatchId]);

  // Memoized data configurations
  const statsCards = useMemo(() => [
    {
      title: 'Upcoming Fixtures',
      value: stats?.upcomingFixtures || 0,
      path: '/fixtures',
      gradient: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
      textColors: 'text-blue-700 dark:text-blue-300',
      hoverColors: 'group-hover:text-blue-500 dark:group-hover:text-blue-300'
    },
    {
      title: 'Teams',
      value: stats?.totalTeams || 0,
      path: '/teams',
      gradient: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
      textColors: 'text-green-700 dark:text-green-300',
      hoverColors: 'group-hover:text-green-500 dark:group-hover:text-green-300'
    },
    {
      title: 'Players',
      value: stats?.totalPlayers || 0,
      path: '/players',
      gradient: 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',
      textColors: 'text-purple-700 dark:text-purple-300',
      hoverColors: 'group-hover:text-purple-500 dark:group-hover:text-purple-300'
    }
  ], [stats]);

  const quickActions = useMemo(() => [
    {
      title: 'Fixtures',
      description: 'Schedule and manage upcoming matches',
      icon: Calendar,
      path: '/fixtures',
      color: 'bg-blue-500 hover:bg-blue-600',
      action: 'View all fixtures',
    },
    {
      title: 'Squad Selection',
      description: 'Select players for next match',
      icon: Users,
      path: '/fixtures',
      color: 'bg-green-500 hover:bg-green-600',
      action: 'Pick your squad',
    },
    {
      title: 'Live Match',
      description: 'Start tracking a live match',
      icon: Play,
      path: '/fixtures',
      color: 'bg-red-500 hover:bg-red-600',
      action: 'Go live',
    },
    {
      title: 'Reports',
      description: 'View match results and player stats',
      icon: BarChart3,
      path: '/reports',
      color: 'bg-purple-500 hover:bg-purple-600',
      action: 'View analytics',
    },
  ], []);

  const additionalActions = useMemo(() => [
    { title: 'Manage Teams', icon: Users, path: '/teams' },
    { title: 'Player Database', icon: Users, path: '/players' },
    { title: 'Club Settings', icon: Settings2, path: '/club-management' },
  ], []);

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="text-center mb-8">
              <div className="h-12 bg-muted rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-6 bg-muted rounded w-2/3 mx-auto"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome back, {firstName}!
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your SideLine Assist is ready. Manage fixtures, track matches, 
            and analyze your team's performance all in one place.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {statsCards.map((card) => (
            <QuickStatsCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={Calendar} // You can extend this to pass different icons
              gradient={card.gradient}
              textColors={card.textColors}
              hoverColors={card.hoverColors}
              onClick={() => handleNavigate(card.path)}
            />
          ))}
        </div>

        {/* Live Match Recovery Banner */}
        {liveMatchData?.hasLiveMatch && liveMatchData.liveMatchId && (
          <LiveMatchBanner
            liveMatchId={liveMatchData.liveMatchId}
            onResumeMatch={handleResumeMatch}
          />
        )}

        {/* Main Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.title}
              title={action.title}
              description={action.description}
              icon={action.icon}
              path={action.path}
              color={action.color}
              action={action.action}
              onClick={() => handleNavigate(action.path)}
            />
          ))}
        </div>

        {/* Additional Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Quick Access</CardTitle>
            <CardDescription>Additional tools and settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {additionalActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={action.path}
                    variant="ghost"
                    className="h-auto p-4 justify-start hover:bg-muted/50"
                    onClick={() => handleNavigate(action.path)}
                  >
                    <IconComponent className="h-5 w-5 mr-3" />
                    <span>{action.title}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Section */}
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-dashed">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="text-xl sm:text-2xl font-bold text-muted-foreground mb-2">
              🤖 SideLine Assist AI Coming Soon
            </div>
            <div className="text-muted-foreground">
              Get intelligent insights and recommendations powered by AI to help improve your team's performance
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

OptimizedIndex.displayName = 'OptimizedIndex';

export default OptimizedIndex;