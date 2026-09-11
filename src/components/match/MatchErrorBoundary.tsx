import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';

function reloadPage() {
  window.location.reload();
}

function MatchErrorFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong.</h1>
        <p className="text-sm text-muted-foreground">
          Your match data is saved — nothing has been lost.
          <br />
          Reload to carry on.
        </p>
        <Button
          onClick={reloadPage}
          className="touch-target w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Reload
        </Button>
      </div>
    </div>
  );
}

interface MatchErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Wraps the live match-day screen. Reassures the coach that match state is
 * safe (it's mirrored to localStorage and the timer is derived from
 * `match_periods` timestamps, so a reload always resyncs) rather than just
 * showing a dead screen. See BUG-028.
 */
export function MatchErrorBoundary({ children }: MatchErrorBoundaryProps) {
  return <ErrorBoundary fallback={<MatchErrorFallback />}>{children}</ErrorBoundary>;
}
