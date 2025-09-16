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
    <div style={style} className="px-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm`}>
            {result}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium">{match.team_name}</span>
              <span className="text-lg font-mono">{match.our_score} - {match.opponent_score}</span>
              <span className="font-medium">{match.opponent_name}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>{format(new Date(match.scheduled_date), 'PPP')}</span>
              <span>•</span>
              <span>{match.location}</span>
              {match.competition_name && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {match.competition_name}
                  </Badge>
                </>
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