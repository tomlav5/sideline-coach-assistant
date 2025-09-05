import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Settings, UserPlus, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamSettings } from './TeamSettings';

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

interface TeamCardProps {
  team: Team;
  onTeamUpdate: () => void;
  onPlayerManagement: (teamId: string) => void;
}

const TEAM_TYPE_LABELS = {
  '5-a-side': '5-a-side',
  '7-a-side': '7-a-side', 
  '9-a-side': '9-a-side',
  '11-a-side': '11-a-side',
};

export function TeamCard({ team, onTeamUpdate, onPlayerManagement }: TeamCardProps) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const getTeamTypeLabel = (type: string) => {
    return TEAM_TYPE_LABELS[type as keyof typeof TEAM_TYPE_LABELS] || type;
  };

  const handleFixtures = () => {
    navigate('/fixtures');
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              <CardDescription>{team.club.name}</CardDescription>
            </div>
            <Badge variant="secondary">
              {getTeamTypeLabel(team.team_type)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              {team._count?.team_players || 0} players
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onPlayerManagement(team.id)}
                className="flex-1"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Players
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleFixtures}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Fixtures
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TeamSettings
        team={team}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onTeamUpdate={onTeamUpdate}
      />
    </>
  );
}