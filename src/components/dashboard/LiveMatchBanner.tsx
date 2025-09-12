import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LiveMatchBannerProps {
  liveMatchId: string;
  onResumeMatch: () => void;
}

export const LiveMatchBanner = memo(({ liveMatchId, onResumeMatch }: LiveMatchBannerProps) => {
  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 mb-6">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
            <div>
              <h3 className="font-semibold">Live Match in Progress</h3>
              <p className="text-sm text-muted-foreground">You have an active match tracking session</p>
            </div>
          </div>
          <Button 
            onClick={onResumeMatch}
            variant="default"
            size="sm"
          >
            Resume Match
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

LiveMatchBanner.displayName = 'LiveMatchBanner';