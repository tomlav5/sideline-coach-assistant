import { Badge } from '@/components/ui/badge';
import { Timer } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
}

interface ActivePlayerCardProps {
  player: Player;
  playingMinutes: number;
  isActive: boolean;
}

export function ActivePlayerCard({ player, playingMinutes, isActive }: ActivePlayerCardProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {player.jersey_number && (
          <Badge 
            variant="default" 
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-green-600 hover:bg-green-700"
          >
            {player.jersey_number}
          </Badge>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {player.first_name} {player.last_name}
          </div>
          <div className="text-xs text-muted-foreground">
            On field
          </div>
        </div>
      </div>
      
      {isActive && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-full">
            <Timer className="h-3.5 w-3.5" />
            <span className="text-sm font-mono font-bold">
              {formatTime(playingMinutes)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
