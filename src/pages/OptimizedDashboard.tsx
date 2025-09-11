import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, Play, TrendingUp, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function OptimizedDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardData();

  const resumeMatch = () => {
    if (data?.activeMatch) {
      navigate(`/match-day/${data.activeMatch.id}`);
    }
  };

  const ActiveMatchCard = () => {
    if (!data?.activeMatch) return null;

    const activeMatch = data.activeMatch;

    return (
      <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 bg-orange-500 rounded-full animate-pulse"></div>
              <CardTitle className="text-orange-800 dark:text-orange-200">Active Match</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              {activeMatch.match_status === 'in_progress' ? 'In Progress' : 'Resumable'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                {activeMatch.team.name} vs {activeMatch.opponent_name}
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-sm text-orange-700 dark:text-orange-300">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(activeMatch.scheduled_date), 'MMM d, h:mm a')}</span>
              </div>
              {activeMatch.location && (
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{activeMatch.location}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={resumeMatch} className="bg-orange-600 hover:bg-orange-700 text-white">
                <Play className="h-4 w-4 mr-2" />
                Resume Match
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate(`/fixtures/${activeMatch.id}`)}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                View Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { clubs = [], stats, activeMatch } = data || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your teams.
          </p>
        </div>
        <Button onClick={() => navigate('/club-management')} className="touch-target">
          <Plus className="h-4 w-4 mr-2" />
          Create Club
        </Button>
      </div>

      {/* Active Match Section */}
      <ActiveMatchCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Clubs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{stats?.clubs || 0}</div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{stats?.teams || 0}</div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{stats?.players || 0}</div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Fixtures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{stats?.upcomingFixtures || 0}</div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clubs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Clubs</h2>
        </div>

        {clubs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No clubs yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first club to start managing teams and players.
              </p>
              <Button onClick={() => navigate('/club-management')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Club
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => (
              <Card key={club.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    {club.logo_url ? (
                      <img 
                        src={club.logo_url} 
                        alt={club.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{club.name}</CardTitle>
                      <CardDescription>
                        Created {new Date(club.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/teams')}
                      className="flex-1"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Teams
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/fixtures')}
                      className="flex-1"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Fixtures
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to get you started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={() => navigate('/teams')}
            >
              <Users className="h-6 w-6" />
              <span>Manage Teams</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={() => navigate('/fixtures')}
            >
              <Calendar className="h-6 w-6" />
              <span>Schedule Fixture</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={() => navigate('/fixtures')}
            >
              <Play className="h-6 w-6" />
              <span>Start Match</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={() => navigate('/reports')}
            >
              <TrendingUp className="h-6 w-6" />
              <span>View Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}