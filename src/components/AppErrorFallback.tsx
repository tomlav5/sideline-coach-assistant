import { Button } from '@/components/ui/button';

function reloadPage() {
  window.location.reload();
}

/**
 * Top-level backstop fallback (App.tsx). Catches render errors on any screen
 * that doesn't have its own boundary, so the app shows a message instead of
 * going blank. See BUG-028.
 */
export function AppErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong.</h1>
        <p className="text-sm text-muted-foreground">Reload the page to continue.</p>
        <Button onClick={reloadPage} className="touch-target w-full">
          Reload
        </Button>
      </div>
    </div>
  );
}
