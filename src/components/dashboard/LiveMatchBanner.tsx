import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LiveMatchBannerProps {
  liveMatchId: string;
  isActiveTracker?: boolean;
  trackerInfo?: {
    activeTrackerId: string | null;
    trackingStartedAt: string | null;
  };
  onResumeMatch: () => void;
}

export const LiveMatchBanner = memo(({ 
  liveMatchId, 
  isActiveTracker, 
  trackerInfo, 
  onResumeMatch 
}: LiveMatchBannerProps) => {
  const isBeingTracked = trackerInfo?.activeTrackerId;
  const trackingStartTime = trackerInfo?.trackingStartedAt;

  if (isActiveTracker) {
    // User is actively tracking this match
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="default" className="bg-green-500 animate-pulse w-fit">
                <User className="h-3 w-3 mr-1" />
                TRACKING
              </Badge>
              <Button 
                onClick={onResumeMatch}
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Resume Match
              </Button>
            </div>
            <div>
              <h3 className="font-semibold text-green-700 dark:text-green-300">You're Tracking This Match</h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                Active match tracking session
                {trackingStartTime && (
                  <span className="block sm:inline"> • Started {formatDistanceToNow(new Date(trackingStartTime))} ago</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isBeingTracked && !isActiveTracker) {
    // Someone else is tracking this match
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-yellow-500 text-white">
                <Lock className="h-3 w-3 mr-1" />
                LOCKED
              </Badge>
              <div>
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-300">Match Being Tracked</h3>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Another user is currently tracking this match
                  {trackingStartTime && (
                    <span> • Started {formatDistanceToNow(new Date(trackingStartTime))} ago</span>
                  )}
                </p>
              </div>
            </div>
            <Button 
              onClick={onResumeMatch}
              variant="outline"
              size="sm"
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-300 dark:hover:bg-yellow-950"
            >
              View Match
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: Regular live match banner
  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 mb-6">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
            <div>
              <h3 className="font-semibold">Live Match Available</h3>
              <p className="text-sm text-muted-foreground">You have an active match available for tracking</p>
            </div>
          </div>
          <Button 
            onClick={onResumeMatch}
            variant="default"
            size="sm"
          >
            Start Tracking
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

LiveMatchBanner.displayName = 'LiveMatchBanner';