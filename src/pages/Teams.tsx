import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '@/hooks/useTeams';
import { useClubs } from '@/hooks/useClubs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamCard } from '@/components/teams/TeamCard';
import { TeamDialog } from '@/components/teams/TeamDialog';

interface Club {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  team_type: string;
  club_id: string;
  created_at: string;
  club: Club;
  _count?: {
    team_players: number;
  };
}

export default function Teams() {
  const navigate = useNavigate();
  const { data: teams = [], isLoading } = useTeams();
  const { data: clubs = [] } = useClubs();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handlePlayerManagement = (teamId: string) => {
    // Navigate to players page with team filter
    navigate(`/players?team=${teamId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-muted-foreground">Manage your club teams</p>
        </div>
        
        <Button 
          className="touch-target"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first team to start managing players and fixtures
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onTeamUpdate={() => {}} // React Query handles updates automatically
              onPlayerManagement={handlePlayerManagement}
            />
          ))}
        </div>
      )}

      <TeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clubs={clubs}
        onTeamCreated={() => {}} // React Query handles updates automatically
      />
    </div>
  );
}