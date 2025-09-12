import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Home, Plane, Trophy, Users, Play, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Fixture {
  id: string;
  scheduled_date: string;
  opponent_name: string;
  location: string | null;
  fixture_type: 'home' | 'away';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  half_length: number;
  team_id: string;
  competition_type: 'league' | 'tournament' | 'friendly';
  competition_name: string | null;
  selected_squad_data: any;
  team: {
    id: string;
    name: string;
    club: {
      id: string;
      name: string;
    };
  };
}

export default function FixtureDetail() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fixtureId) {
      fetchFixture();
    }
  }, [fixtureId]);

  const fetchFixture = async () => {
    try {
      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          *,
          team:teams!fk_fixtures_team_id(
            id,
            name,
            club:clubs(id, name)
          )
        `)
        .eq('id', fixtureId)
        .single();

      if (error) throw error;
      setFixture(data as unknown as Fixture);
    } catch (error) {
      console.error('Error fetching fixture:', error);
      toast({
        title: "Error",
        description: "Failed to load fixture details",
        variant: "destructive",
      });
      navigate('/fixtures');
    } finally {
      setLoading(false);
    }
  };

  const startMatch = () => {
    if (!fixture) return;
    
    // Check if squad is selected
    if (!fixture.selected_squad_data || 
        (!fixture.selected_squad_data.startingLineup?.length && !fixture.selected_squad_data.selectedPlayerIds?.length)) {
      toast({
        title: "Squad Required",
        description: "Please select your squad before starting the match",
        variant: "destructive",
      });
      navigate(`/squad/${fixture.id}`);
      return;
    }

    navigate(`/match-day/${fixture.id}`, {
      state: {
        squad: fixture.selected_squad_data.startingLineup?.concat(fixture.selected_squad_data.substitutes || []) || 
               fixture.selected_squad_data.selectedPlayers || [],
        starters: fixture.selected_squad_data.startingLineup?.map((player: any) => player.id) || 
                 fixture.selected_squad_data.startingPlayerIds || [],
        substitutes: fixture.selected_squad_data.substitutes || 
                    fixture.selected_squad_data.selectedPlayers?.filter((p: any) => 
                      !fixture.selected_squad_data.startingPlayerIds?.includes(p.id)) || []
      }
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading fixture details...</div>
        </div>
      </div>
    );
  }

  if (!fixture) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Fixture Not Found</h1>
          <Button onClick={() => navigate('/fixtures')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fixtures
          </Button>
        </div>
      </div>
    );
  }

  const isUpcoming = fixture.status === 'scheduled';
  const hasSquad = fixture.selected_squad_data && 
    (fixture.selected_squad_data.startingLineup?.length > 0 || fixture.selected_squad_data.selectedPlayerIds?.length > 0);
  const TypeIcon = fixture.fixture_type === 'home' ? Home : Plane;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'default';
      case 'in_progress': return 'secondary';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/fixtures')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fixtures
        </Button>
      </div>

      <div className="space-y-6">
        {/* Main Fixture Details */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <TypeIcon className="h-6 w-6" />
                  {fixture.team.name} vs {fixture.opponent_name}
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  {fixture.team.club.name}
                </CardDescription>
              </div>
              <Badge variant={getStatusColor(fixture.status)} className="text-sm">
                {fixture.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Match Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {format(new Date(fixture.scheduled_date), 'EEEE, MMMM do, yyyy')}
                    </div>
                    <div className="text-sm text-muted-foreground">Match Date</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {format(new Date(fixture.scheduled_date), 'h:mm a')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {fixture.half_length} minute halves
                    </div>
                  </div>
                </div>

                {fixture.location && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{fixture.location}</div>
                      <div className="text-sm text-muted-foreground">Venue</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {fixture.competition_type !== 'friendly' && (
                  <div className="flex items-center space-x-3">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {fixture.competition_type === 'league' ? 'League Match' : 'Tournament'}
                      </div>
                      {fixture.competition_name && (
                        <div className="text-sm text-muted-foreground">
                          {fixture.competition_name}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {fixture.fixture_type === 'home' ? 'Home Match' : 'Away Match'}
                    </div>
                    <div className="text-sm text-muted-foreground">Match Type</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Squad Status */}
            <div className="border-t pt-6">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Squad Selection</div>
                  <div className="text-sm text-muted-foreground">
                    {hasSquad 
                      ? `${fixture.selected_squad_data.startingLineup?.length || fixture.selected_squad_data.selectedPlayerIds?.length || 0} players selected`
                      : 'No squad selected yet'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isUpcoming && (
              <div className="border-t pt-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => navigate(`/squad/${fixture.id}`)}
                    variant="outline"
                    className="flex-1"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {hasSquad ? 'Review Squad' : 'Select Squad'}
                  </Button>
                  <Button
                    onClick={startMatch}
                    disabled={!hasSquad}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Match
                  </Button>
                </div>
                {!hasSquad && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Select your squad before starting the match
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Squad Preview */}
        {hasSquad && (
          <Card>
            <CardHeader>
              <CardTitle>Selected Squad</CardTitle>
              <CardDescription>
                Starting lineup for this match
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {(fixture.selected_squad_data.startingLineup || []).map((player: any, index: number) => (
                  <div
                    key={player.id}
                    className="p-3 bg-muted rounded-lg text-center"
                  >
                    <div className="font-medium text-sm">
                      {player.first_name} {player.last_name}
                    </div>
                    {player.jersey_number && (
                      <div className="text-xs text-muted-foreground">
                        #{player.jersey_number}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(fixture.selected_squad_data.substitutes && fixture.selected_squad_data.substitutes.length > 0) && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Substitutes</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {fixture.selected_squad_data.substitutes.map((player: any) => (
                      <div
                        key={player.id}
                        className="p-2 bg-muted/50 rounded text-center"
                      >
                        <div className="font-medium text-sm">
                          {player.first_name} {player.last_name}
                        </div>
                        {player.jersey_number && (
                          <div className="text-xs text-muted-foreground">
                            #{player.jersey_number}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}