import { AlertTriangle, Lock, Unlock, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { MatchTracker } from '@/hooks/useRealtimeMatchSync';

// Floodlight — see docs/brand/BRAND.md. Scoped locally, per the precedent set by the
// header/tile-grid branches (DESIGN-002 covers the app-wide token migration).
const FLOODLIGHT = {
  navy: '#101724',
  paper: '#EEF1F4',
  card: '#FFFFFF',
  edge: '#CBD3DC',
  pitchBlue: '#0B5FCC',
  amber: '#F5A524',
};

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

  // User is actively tracking — a statement of fact, not an action, so it stays
  // quiet: navy on Paper, not loud.
  if (matchTracker?.isActiveTracker) {
    return (
      <Alert className="mb-4" style={{ backgroundColor: FLOODLIGHT.paper, borderColor: FLOODLIGHT.edge }}>
        <Lock className="h-4 w-4" style={{ color: FLOODLIGHT.navy }} />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-medium" style={{ color: FLOODLIGHT.navy }}>
              You are actively tracking this match
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="w-fit border"
                style={{ backgroundColor: FLOODLIGHT.card, color: FLOODLIGHT.navy, borderColor: FLOODLIGHT.edge }}
              >
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
            className="w-full sm:w-auto hover:brightness-95"
            style={{ borderColor: FLOODLIGHT.navy, color: FLOODLIGHT.navy, backgroundColor: FLOODLIGHT.card }}
          >
            <Unlock className="h-3 w-3 mr-1" />
            Release Control
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Another user is tracking — informational, Pitch Blue.
  if (matchTracker && !matchTracker.isActiveTracker) {
    return (
      <Alert
        className="mb-4"
        style={{ backgroundColor: 'rgba(11, 95, 204, 0.08)', borderColor: 'rgba(11, 95, 204, 0.35)' }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: FLOODLIGHT.pitchBlue }} />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-medium" style={{ color: FLOODLIGHT.pitchBlue }}>
              This match is currently being tracked by another user
            </span>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="w-fit border-0"
                style={{ backgroundColor: 'rgba(11, 95, 204, 0.14)', color: FLOODLIGHT.pitchBlue }}
              >
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

  // No one is tracking - show claim option for live/in-progress matches. The
  // surrounding banner stays informational (Pitch Blue, same as above); the button
  // is the actual action, so it — and only it — takes Signal Amber.
  if (matchStatus === 'in_progress' || matchStatus === 'live') {
    return (
      <Alert
        className="mb-4"
        style={{ backgroundColor: 'rgba(11, 95, 204, 0.08)', borderColor: 'rgba(11, 95, 204, 0.35)' }}
      >
        <User className="h-4 w-4" style={{ color: FLOODLIGHT.pitchBlue }} />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="font-medium" style={{ color: FLOODLIGHT.pitchBlue }}>
            This match is available for tracking
          </span>
          <Button
            onClick={onClaimTracking}
            disabled={isClaimingMatch}
            size="sm"
            className="w-full sm:w-auto border-0 hover:brightness-95"
            style={{ backgroundColor: FLOODLIGHT.amber, color: FLOODLIGHT.navy }}
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