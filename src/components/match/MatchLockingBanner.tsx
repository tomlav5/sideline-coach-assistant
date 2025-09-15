import { AlertTriangle, Lock, Unlock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { MatchTracker } from '@/hooks/useRealtimeMatchSync';

interface MatchLockingBannerProps {
  matchTracker: MatchTracker | null;
  onClaimTracking: () => void;
  onReleaseTracking: () => void;
  isClaimingMatch: boolean;
  matchStatus: string;
}

export function MatchLockingBanner({
  matchTracker,
  onClaimTracking,
  onReleaseTracking,
  isClaimingMatch,
  matchStatus
}: MatchLockingBannerProps) {
  // Don't show banner for completed matches
  if (matchStatus === 'completed') {
    return null;
  }

  // User is actively tracking
  if (matchTracker?.isActiveTracker) {
    return (
      <Alert className="mb-4 border-green-500/50 bg-green-500/10">
        <Lock className="h-4 w-4 text-green-500" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-green-700 dark:text-green-300 font-medium">
              You are actively tracking this match
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 w-fit">
                <User className="h-3 w-3 mr-1" />
                Active Tracker
              </Badge>
              {matchTracker.trackerStartedAt && (
                <span className="text-xs text-muted-foreground">
                  Started {formatDistanceToNow(new Date(matchTracker.trackerStartedAt))} ago
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReleaseTracking}
            className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950 w-full sm:w-auto"
          >
            <Unlock className="h-3 w-3 mr-1" />
            Release Control
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Another user is tracking
  if (matchTracker && !matchTracker.isActiveTracker) {
    return (
      <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-yellow-700 dark:text-yellow-300 font-medium">
              This match is currently being tracked by another user
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 w-fit">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
              {matchTracker.trackerStartedAt && (
                <span className="text-xs text-muted-foreground">
                  Started {formatDistanceToNow(new Date(matchTracker.trackerStartedAt))} ago
                </span>
              )}
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            You can view updates in real-time
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // No one is tracking - show claim option for live/in-progress matches
  if (matchStatus === 'in_progress' || matchStatus === 'live') {
    return (
      <Alert className="mb-4 border-blue-500/50 bg-blue-500/10">
        <User className="h-4 w-4 text-blue-500" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            This match is available for tracking
          </span>
          <Button
            onClick={onClaimTracking}
            disabled={isClaimingMatch}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Lock className="h-3 w-3 mr-1" />
            {isClaimingMatch ? 'Claiming...' : 'Take Control'}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}