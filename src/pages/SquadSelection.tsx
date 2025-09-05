import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Play, UserCheck, UserX, Star, ArrowLeft, UserPlus } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);

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
          team:teams(
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
      setTeam(fixtureData.team);

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
        .eq('team_id', fixtureData.team.id);

      if (playersError) throw playersError;
      
      const players = teamPlayersData.map(tp => tp.players);
      setAvailablePlayers(players);

      // Load saved squad selection if exists
      if (fixtureData.selected_squad_data && typeof fixtureData.selected_squad_data === 'object') {
        const savedData = fixtureData.selected_squad_data as any;
        const savedSelectedPlayers = players.filter(p => savedData.selectedPlayerIds?.includes(p.id));
        const savedStartingPlayers = new Set<string>(savedData.startingPlayerIds || []);
        
        setSelectedPlayers(savedSelectedPlayers);
        setStartingPlayers(savedStartingPlayers);
      }
      
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

  const loadMostRecentSquad = async () => {
    if (!team) return;
    
    try {
      // Find the most recent fixture with a saved squad for this team
      const { data: recentFixture, error } = await supabase
        .from('fixtures')
        .select('selected_squad_data')
        .eq('team_id', team.id)
        .not('selected_squad_data', 'is', null)
        .neq('id', fixtureId) // Exclude current fixture
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (recentFixture?.selected_squad_data) {
        const savedData = recentFixture.selected_squad_data as any;
        const recentSelectedPlayers = availablePlayers.filter(p => savedData.selectedPlayerIds?.includes(p.id));
        const recentStartingPlayers = new Set<string>(
          savedData.startingPlayerIds?.filter((id: string) => recentSelectedPlayers.some(p => p.id === id)) || []
        );
        
        setSelectedPlayers(recentSelectedPlayers);
        setStartingPlayers(recentStartingPlayers);
        
        toast({
          title: "Recent Squad Loaded",
          description: `Loaded squad from previous fixture (${recentSelectedPlayers.length} players)`,
        });
      } else {
        toast({
          title: "No Recent Squad",
          description: "No previous squad selections found for this team",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading recent squad:', error);
      toast({
        title: "Error",
        description: "Failed to load recent squad",
        variant: "destructive",
      });
    }
  };

  const saveSquadSelection = async () => {
    if (!fixtureId) return;
    
    try {
      setSaving(true);
      
      const squadData = {
        selectedPlayerIds: selectedPlayers.map(p => p.id),
        startingPlayerIds: Array.from(startingPlayers),
        startingLineup: selectedPlayers
          .filter(p => startingPlayers.has(p.id))
          .map(p => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, jersey_number: p.jersey_number })),
        substitutes: selectedPlayers
          .filter(p => !startingPlayers.has(p.id))
          .map(p => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, jersey_number: p.jersey_number })),
        savedAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from('fixtures')
        .update({ selected_squad_data: squadData })
        .eq('id', fixtureId);

      if (error) throw error;

      toast({
        title: "Squad Committed to Memory ✓",
        description: "Squad selection has been permanently saved for this fixture and can be recalled anytime",
        duration: 4000,
      });
    } catch (error) {
      console.error('Error saving squad:', error);
      toast({
        title: "Error",
        description: "Failed to save squad selection",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startMatch = () => {
    if (!canStartMatch()) return;
    
    // Navigate to match tracking with squad data
    navigate(`/match-day/${fixtureId}`, {
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/fixtures')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Squad Selection</h1>
            <p className="text-sm md:text-base text-muted-foreground">Select your squad for the upcoming match</p>
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
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Users className={`h-5 w-5 ${isSquadValid() ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-sm font-medium">
              Squad {isSquadValid() ? 'Valid' : 'Too Small'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <UserPlus className={`h-5 w-5 ${canStartMatch() ? 'text-green-600' : 'text-amber-600'}`} />
            <span className="text-sm font-medium">
              {canStartMatch() ? 'Ready to Start' : 'Not Ready'}
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2 sm:ml-auto">
           <Button 
             onClick={loadMostRecentSquad} 
             disabled={loading}
             variant="outline"
             size="sm"
           >
             Load Recent Squad
           </Button>
           <Button 
             onClick={saveSquadSelection} 
             disabled={selectedPlayers.length === 0 || saving}
             variant="default"
             size="sm"
             className="bg-blue-600 hover:bg-blue-700"
           >
             {saving ? 'Saving...' : 'Save Squad'}
           </Button>
          <Button 
            onClick={startMatch} 
            disabled={!canStartMatch()}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Match
          </Button>
        </div>
      </div>

      {/* Player Selection */}
      <div className="grid gap-4 md:gap-6">
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
          <CardContent className="p-4 md:p-6">
            {availablePlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No players assigned to this team yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
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
                              className="h-6 px-1.5 text-xs"
                            >
                              <Star className="h-3 w-3" />
                              <span className="ml-0.5">
                                {isStarter ? 'Start' : 'Sub'}
                              </span>
                            </Button>
                          )}
                        </div>
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
            <CardContent className="p-4 md:p-6 space-y-4">
              {/* Starting Players */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-2 text-yellow-500" />
                  Starting XI ({startingPlayers.size}/{teamSize})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {selectedPlayers
                    .filter(p => startingPlayers.has(p.id))
                    .map(player => (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {selectedPlayers
                    .filter(p => !startingPlayers.has(p.id))
                    .map(player => (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded">
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