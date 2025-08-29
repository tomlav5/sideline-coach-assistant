import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, Play, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Club {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

interface DashboardStats {
  clubs: number;
  teams: number;
  players: number;
  upcomingFixtures: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    clubs: 0,
    teams: 0,
    players: 0,
    upcomingFixtures: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch clubs the user is a member of
        const { data: clubsData, error: clubsError } = await supabase
          .from('clubs')
          .select(`
            id,
            name,
            logo_url,
            created_at,
            club_members!inner(role)
          `)
          .eq('club_members.user_id', user.id);

        if (clubsError) throw clubsError;

        setClubs(clubsData || []);

        // Fetch aggregate stats
        const clubIds = clubsData?.map(club => club.id) || [];
        
        if (clubIds.length > 0) {
          const [teamsData, playersData, fixturesData] = await Promise.all([
            supabase.from('teams').select('id').in('club_id', clubIds),
            supabase.from('players').select('id').in('club_id', clubIds),
            supabase
              .from('fixtures')
              .select('id')
              .in('team_id', 
                (await supabase.from('teams').select('id').in('club_id', clubIds)).data?.map(t => t.id) || []
              )
              .eq('status', 'scheduled')
              .gte('scheduled_date', new Date().toISOString())
          ]);

          setStats({
            clubs: clubsData?.length || 0,
            teams: teamsData.data?.length || 0,
            players: playersData.data?.length || 0,
            upcomingFixtures: fixturesData.data?.length || 0
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
              <div className="text-2xl font-bold">{stats.clubs}</div>
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
              <div className="text-2xl font-bold">{stats.teams}</div>
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
              <div className="text-2xl font-bold">{stats.players}</div>
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
              <div className="text-2xl font-bold">{stats.upcomingFixtures}</div>
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
              onClick={() => navigate('/match')}
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