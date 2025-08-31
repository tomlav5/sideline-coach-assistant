import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Clock, Users, ArrowRight, Plus, Play, BarChart3, Settings2 } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    upcomingFixtures: 0,
    totalTeams: 0,
    totalPlayers: 0,
  });
  const [hasLiveMatch, setHasLiveMatch] = useState(false);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  
  // Extract first name from user profile or metadata
  const firstName = user?.user_metadata?.first_name || 
                   user?.email?.split('@')[0] || 
                   'Coach';

  useEffect(() => {
    if (user) {
      fetchStats();
      checkForLiveMatch();
    }
  }, [user]);

  // Auto-refresh stats when component comes into focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchStats();
        checkForLiveMatch();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user]);

  const checkForLiveMatch = () => {
    // Check localStorage for any active match sessions
    const keys = Object.keys(localStorage);
    const matchKeys = keys.filter(key => key.startsWith('match_'));
    
    if (matchKeys.length > 0) {
      const latestMatchKey = matchKeys[0];
      const matchId = latestMatchKey.replace('match_', '');
      
      try {
        const matchData = JSON.parse(localStorage.getItem(latestMatchKey) || '{}');
        const timeSinceLastSave = Date.now() - (matchData.timestamp || 0);
        
        // If match was active within last 12 hours
        if (timeSinceLastSave < 12 * 60 * 60 * 1000 && matchData.gameState?.matchPhase !== 'completed') {
          setHasLiveMatch(true);
          setLiveMatchId(matchId);
        }
      } catch (error) {
        console.error('Error checking live match:', error);
      }
    }
  };

  const fetchStats = async () => {
    try {
      // Get upcoming fixtures count
      const { count: fixtureCount } = await supabase
        .from('fixtures')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'scheduled');

      // Get teams count
      const { count: teamCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });

      // Get players count
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });

      setStats({
        upcomingFixtures: fixtureCount || 0,
        totalTeams: teamCount || 0,
        totalPlayers: playerCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const quickActions = [
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
  ];

  const additionalActions = [
    { title: 'Manage Teams', icon: Users, path: '/teams' },
    { title: 'Player Database', icon: Users, path: '/players' },
    { title: 'Club Settings', icon: Settings2, path: '/club-management' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome back, {firstName}!
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your sideline coaching assistant is ready. Manage fixtures, track matches, 
            and analyze your team's performance all in one place.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card 
            className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-all duration-300 group"
            onClick={() => navigate('/fixtures')}
          >
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform">
                {stats.upcomingFixtures}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 mt-1 group-hover:text-blue-500 dark:group-hover:text-blue-300">
                Upcoming Fixtures
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to view all →
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-all duration-300 group"
            onClick={() => navigate('/teams')}
          >
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300 group-hover:scale-110 transition-transform">
                {stats.totalTeams}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400 mt-1 group-hover:text-green-500 dark:group-hover:text-green-300">
                Teams
              </div>
              <div className="text-xs text-green-500 dark:text-green-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to manage →
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-all duration-300 group"
            onClick={() => navigate('/players')}
          >
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300 group-hover:scale-110 transition-transform">
                {stats.totalPlayers}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400 mt-1 group-hover:text-purple-500 dark:group-hover:text-purple-300">
                Players
              </div>
              <div className="text-xs text-purple-500 dark:text-purple-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to view all →
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Match Recovery Banner */}
        {hasLiveMatch && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 mb-6">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
                  <div>
                    <h3 className="font-semibold">Live Match in Progress</h3>
                    <p className="text-sm text-muted-foreground">You have an active match tracking session</p>
                  </div>
                </div>
                <Button 
                  onClick={() => navigate(`/match-day/${liveMatchId}`)}
                  variant="default"
                  size="sm"
                >
                  Resume Match
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Card 
                key={action.path}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20"
                onClick={() => navigate(action.path)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${action.color} text-white`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-xl">{action.title}</CardTitle>
                  <CardDescription className="text-base">
                    {action.description}
                  </CardDescription>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 self-start group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    {action.action}
                  </Button>
                </CardHeader>
              </Card>
            );
          })}
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
                    onClick={() => navigate(action.path)}
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
              🤖 AI Assistant Coming Soon
            </div>
            <div className="text-muted-foreground">
              Get intelligent insights and recommendations powered by AI to help improve your team's performance
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
