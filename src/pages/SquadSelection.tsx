import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Play, UserCheck, UserX, Star, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
}

interface Team {
  id: string;
  name: string;
  team_type: '5-a-side' | '7-a-side' | '9-a-side' | '11-a-side';
  club_id: string;
}

interface Fixture {
  id: string;
  opponent_name: string;
  fixture_type: 'home' | 'away';
  scheduled_date: string;
  location: string | null;
}

const TEAM_SIZE_MAP = {
  '5-a-side': 5,
  '7-a-side': 7,
  '9-a-side': 9,
  '11-a-side': 11,
};

export default function SquadSelection() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [startingPlayers, setStartingPlayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fixtureId) {
      fetchFixtureData();
    }
  }, [fixtureId]);

  const fetchFixtureData = async () => {
    try {
      setLoading(true);
      
      // Fetch fixture and team data
      const { data: fixtureData, error: fixtureError } = await supabase
        .from('fixtures')
        .select(`
          *,
          teams!inner(
            id,
            name,
            team_type,
            club_id
          )
        `)
        .eq('id', fixtureId)
        .single();

      if (fixtureError) throw fixtureError;
      
      setFixture(fixtureData);
      setTeam(fixtureData.teams);

      // Fetch team players
      const { data: teamPlayersData, error: playersError } = await supabase
        .from('team_players')
        .select(`
          players!inner(
            id,
            first_name,
            last_name,
            jersey_number
          )
        `)
        .eq('team_id', fixtureData.teams.id);

      if (playersError) throw playersError;
      
      const players = teamPlayersData.map(tp => tp.players);
      setAvailablePlayers(players);
      
    } catch (error) {
      console.error('Error fetching fixture data:', error);
      toast({
        title: "Error",
        description: "Failed to load fixture data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePlayerSelection = (player: Player) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id);
      if (isSelected) {
        // Remove player and also from starting lineup
        setStartingPlayers(prev => {
          const newStarting = new Set(prev);
          newStarting.delete(player.id);
          return newStarting;
        });
        return prev.filter(p => p.id !== player.id);
      } else {
        return [...prev, player];
      }
    });
  };

  const toggleStartingPlayer = (playerId: string) => {
    setStartingPlayers(prev => {
      const newStarting = new Set(prev);
      if (newStarting.has(playerId)) {
        newStarting.delete(playerId);
      } else {
        // Check if we're at the team size limit for starting players
        const teamSize = team ? TEAM_SIZE_MAP[team.team_type] : 11;
        if (newStarting.size < teamSize) {
          newStarting.add(playerId);
        } else {
          toast({
            title: "Maximum starters reached",
            description: `You can only select ${teamSize} starting players for ${team?.team_type}`,
            variant: "destructive",
          });
        }
      }
      return newStarting;
    });
  };

  const isSquadValid = () => {
    if (!team) return false;
    const teamSize = TEAM_SIZE_MAP[team.team_type];
    const minSquadSize = teamSize - 1;
    return selectedPlayers.length >= minSquadSize;
  };

  const canStartMatch = () => {
    if (!team) return false;
    const teamSize = TEAM_SIZE_MAP[team.team_type];
    return startingPlayers.size === teamSize && isSquadValid();
  };

  const startMatch = () => {
    if (!canStartMatch()) return;
    
    // Navigate to match tracking with squad data
    navigate(`/match/${fixtureId}`, {
      state: {
        squad: selectedPlayers,
        starters: Array.from(startingPlayers),
        substitutes: selectedPlayers.filter(p => !startingPlayers.has(p.id))
      }
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!fixture || !team) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Fixture not found</h1>
          <Button onClick={() => navigate('/fixtures')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Fixtures
          </Button>
        </div>
      </div>
    );
  }

  const teamSize = TEAM_SIZE_MAP[team.team_type];
  const minSquadSize = teamSize - 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/fixtures')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Squad Selection</h1>
            <p className="text-muted-foreground">Select your squad for the upcoming match</p>
          </div>
        </div>
      </div>

      {/* Match Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{team.name} vs {fixture.opponent_name}</span>
            <Badge variant={fixture.fixture_type === 'home' ? 'default' : 'secondary'}>
              {fixture.fixture_type}
            </Badge>
          </CardTitle>
          <CardDescription>
            {formatDateTime(fixture.scheduled_date)}
            {fixture.location && ` • ${fixture.location}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium">Team Type</p>
              <p className="text-muted-foreground">{team.team_type}</p>
            </div>
            <div>
              <p className="font-medium">Squad Size</p>
              <p className="text-muted-foreground">
                {selectedPlayers.length} / {availablePlayers.length}
                <span className={selectedPlayers.length >= minSquadSize ? 'text-green-600' : 'text-red-600'}>
                  {' '}(min: {minSquadSize})
                </span>
              </p>
            </div>
            <div>
              <p className="font-medium">Starting Players</p>
              <p className="text-muted-foreground">
                {startingPlayers.size} / {teamSize}
              </p>
            </div>
            <div>
              <p className="font-medium">Substitutes</p>
              <p className="text-muted-foreground">
                {selectedPlayers.length - startingPlayers.size} (unlimited)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Squad Status */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Badge variant={isSquadValid() ? 'default' : 'destructive'}>
            {isSquadValid() ? 'Squad Valid' : 'Squad Too Small'}
          </Badge>
          <Badge variant={canStartMatch() ? 'default' : 'secondary'}>
            {canStartMatch() ? 'Ready to Start' : 'Not Ready'}
          </Badge>
        </div>
        
        <Button 
          onClick={startMatch} 
          disabled={!canStartMatch()}
          className="bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Match
        </Button>
      </div>

      {/* Player Selection */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Available Players
            </CardTitle>
            <CardDescription>
              Select players for the squad. Minimum {minSquadSize} players required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availablePlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No players assigned to this team yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availablePlayers.map((player) => {
                  const isSelected = selectedPlayers.some(p => p.id === player.id);
                  const isStarter = startingPlayers.has(player.id);
                  
                  return (
                    <div 
                      key={player.id}
                      className={`
                        p-3 border rounded-lg cursor-pointer transition-all
                        ${isSelected 
                          ? isStarter 
                            ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-muted hover:border-primary'
                        }
                      `}
                      onClick={() => togglePlayerSelection(player)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {player.first_name} {player.last_name}
                        </span>
                        {player.jersey_number && (
                          <Badge variant="outline" className="text-xs">
                            #{player.jersey_number}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          {isSelected ? (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <UserX className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {isSelected ? 'Selected' : 'Available'}
                          </span>
                        </div>
                        
                        {isSelected && (
                          <Button
                            variant={isStarter ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStartingPlayer(player.id);
                            }}
                            className="h-6 px-2"
                          >
                            <Star className="h-3 w-3 mr-1" />
                            <span className="text-xs">
                              {isStarter ? 'Starter' : 'Sub'}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Squad Summary */}
        {selectedPlayers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Squad Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Starting Players */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-2 text-yellow-500" />
                  Starting XI ({startingPlayers.size}/{teamSize})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {selectedPlayers
                    .filter(p => startingPlayers.has(p.id))
                    .map(player => (
                      <div key={player.id} className="flex items-center space-x-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                        <span className="text-sm font-medium">
                          {player.first_name} {player.last_name}
                        </span>
                        {player.jersey_number && (
                          <Badge variant="outline" className="text-xs">
                            #{player.jersey_number}
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <Separator />

              {/* Substitutes */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-blue-500" />
                  Substitutes ({selectedPlayers.length - startingPlayers.size})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {selectedPlayers
                    .filter(p => !startingPlayers.has(p.id))
                    .map(player => (
                      <div key={player.id} className="flex items-center space-x-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <span className="text-sm font-medium">
                          {player.first_name} {player.last_name}
                        </span>
                        {player.jersey_number && (
                          <Badge variant="outline" className="text-xs">
                            #{player.jersey_number}
                          </Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}