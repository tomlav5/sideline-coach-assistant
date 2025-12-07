import React, { memo } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface MatchItemProps {
  match: {
    id: string;
    scheduled_date: string;
    opponent_name: string;
    location: string;
    our_score: number;
    opponent_score: number;
    team_name: string;
    competition_type?: string;
    competition_name?: string;
  };
  getMatchResult: (ourScore: number, opponentScore: number) => { result: string; color: string };
  onDelete: (matchId: string) => void;
  style?: React.CSSProperties;
}

const MatchItem = memo(({ match, getMatchResult, onDelete, style }: MatchItemProps) => {
  const { result, color } = getMatchResult(match.our_score, match.opponent_score);

  return (
    <div style={style} className="px-2 sm:px-4">
      <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          {/* Result badge */}
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${color} text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0`}>
            {result}
          </div>
          
          {/* Match info */}
          <div className="min-w-0 flex-1">
            {/* Score display - stacked on mobile, inline on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mb-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-medium text-sm sm:text-base truncate max-w-[80px] sm:max-w-none">{match.team_name}</span>
                <span className="text-base sm:text-lg font-mono font-semibold whitespace-nowrap text-primary">{match.our_score} - {match.opponent_score}</span>
                <span className="font-medium text-sm sm:text-base truncate max-w-[80px] sm:max-w-none">{match.opponent_name}</span>
              </div>
            </div>
            
            {/* Match details - simplified on mobile */}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm text-muted-foreground">
              <span className="whitespace-nowrap">{format(new Date(match.scheduled_date), 'dd MMM yyyy')}</span>
              {match.location && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="truncate max-w-[100px] sm:max-w-none">{match.location}</span>
                </>
              )}
              {match.competition_name && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0 h-5">
                  {match.competition_name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`/match-report/${match.id}`} className="w-full cursor-pointer">
                View Details
              </a>
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Match
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Match</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this match? This will permanently remove the match and all associated data including events, player statistics, and time logs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(match.id)} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

MatchItem.displayName = 'MatchItem';

export { MatchItem };