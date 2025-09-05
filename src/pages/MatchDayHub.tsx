import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Play, 
  RotateCcw,
  Trophy,
  Users,
  Target
} from 'lucide-react';
import { format } from 'date-fns';

interface Fixture {
  id: string;
  opponent_name: string;
  scheduled_date: string;
  location: string | null;
  fixture_type: 'home' | 'away';
  match_status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  competition_name: string | null;
  competition_type: 'friendly' | 'league' | 'cup' | 'tournament';
  team: {
    id: string;
    name: string;
    team_type: string;
  };
}

export default function MatchDay() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgressFixtures, setInProgressFixtures] = useState<Fixture[]>([]);
  const [todaysFixtures, setTodaysFixtures] = useState<Fixture[]>([]);
  const [upcomingFixtures, setUpcomingFixtures] = useState<Fixture[]>([]);

  useEffect(() => {
    if (user) {
      fetchFixtures();
    }
  }, [user]);

  const fetchFixtures = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          *,
          team:teams(
            id,
            name,
            team_type
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const inProgress = data?.filter(f => f.match_status === 'in_progress' || f.match_status === 'paused') || [];
      const todays = data?.filter(f => {
        const fixtureDate = new Date(f.scheduled_date);
        const fixtureDay = new Date(fixtureDate.getFullYear(), fixtureDate.getMonth(), fixtureDate.getDate());
        return fixtureDay.getTime() === today.getTime() && f.match_status !== 'completed';
      }) || [];
      const upcoming = data?.filter(f => {
        const fixtureDate = new Date(f.scheduled_date);
        return fixtureDate >= tomorrow && f.match_status === 'not_started';
      }) || [];

      setInProgressFixtures(inProgress as Fixture[]);
      setTodaysFixtures(todays as Fixture[]);
      setUpcomingFixtures(upcoming.slice(0, 5) as Fixture[]); // Limit to 5 upcoming
      setFixtures(data as Fixture[] || []);

    } catch (error) {
      console.error('Error fetching fixtures:', error);
    } finally {
      setLoading(false);
    }
  };

  const resumeMatch = (fixtureId: string) => {
    navigate(`/match-day/${fixtureId}`);
  };

  const startSquadSelection = (fixtureId: string) => {
    navigate(`/squad/${fixtureId}`);
  };

  const getStatusBadge = (fixture: Fixture) => {
    switch (fixture.match_status) {
      case 'in_progress':
        return <Badge className="bg-red-500 text-white animate-pulse">LIVE</Badge>;
      case 'paused':
        return <Badge variant="secondary">PAUSED</Badge>;
      case 'completed':
        return <Badge variant="outline">COMPLETED</Badge>;
      default:
        return <Badge variant="outline">SCHEDULED</Badge>;
    }
  };

  const FixtureCard = ({ fixture, showResumeButton = false, showStartButton = false }: { 
    fixture: Fixture; 
    showResumeButton?: boolean; 
    showStartButton?: boolean;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusBadge(fixture)}
            <Badge variant="outline" className="text-xs">
              {fixture.team.team_type}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {fixture.competition_name && `${fixture.competition_name} • `}
            {fixture.competition_type}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-lg">
              {fixture.team.name} vs {fixture.opponent_name}
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {fixture.fixture_type}
            </div>
          </div>

          <div className="flex items-center text-sm text-muted-foreground gap-4">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(fixture.scheduled_date), 'PPp')}
            </div>
            {fixture.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {fixture.location}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {showResumeButton && (
            <Button 
              onClick={() => resumeMatch(fixture.id)}
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Resume Match
            </Button>
          )}
          {showStartButton && (
            <Button 
              onClick={() => startSquadSelection(fixture.id)}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Select Squad
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading match day data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Match Day</h1>
        <p className="text-muted-foreground">
          Track live matches, resume paused sessions, and prepare for upcoming fixtures
        </p>
      </div>

      {/* Live Matches Section */}
      {inProgressFixtures.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold">Live Matches</h2>
            <Badge className="bg-red-500 text-white animate-pulse">
              {inProgressFixtures.length}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {inProgressFixtures.map((fixture) => (
              <FixtureCard 
                key={fixture.id} 
                fixture={fixture} 
                showResumeButton={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today's Matches */}
      {todaysFixtures.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Today's Matches</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {todaysFixtures.map((fixture) => (
              <FixtureCard 
                key={fixture.id} 
                fixture={fixture} 
                showStartButton={fixture.match_status === 'not_started'}
                showResumeButton={fixture.match_status === 'in_progress' || fixture.match_status === 'paused'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {upcomingFixtures.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-semibold">Upcoming Matches</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingFixtures.map((fixture) => (
              <FixtureCard 
                key={fixture.id} 
                fixture={fixture} 
                showStartButton={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {inProgressFixtures.length === 0 && todaysFixtures.length === 0 && upcomingFixtures.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-semibold mb-2">No Matches Available</h3>
            <p className="text-muted-foreground mb-4">
              Create some fixtures to start tracking matches
            </p>
            <Button onClick={() => navigate('/fixtures')}>
              <Calendar className="h-4 w-4 mr-2" />
              View All Fixtures
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/fixtures')}>
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-3 text-blue-500" />
            <h3 className="font-semibold mb-1">All Fixtures</h3>
            <p className="text-sm text-muted-foreground">View and manage all fixtures</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/teams')}>
          <CardContent className="p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <h3 className="font-semibold mb-1">Teams</h3>
            <p className="text-sm text-muted-foreground">Manage your teams</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/reports')}>
          <CardContent className="p-6 text-center">
            <Trophy className="h-8 w-8 mx-auto mb-3 text-purple-500" />
            <h3 className="font-semibold mb-1">Reports</h3>
            <p className="text-sm text-muted-foreground">View match statistics</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}