import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Goal, Target, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Floodlight Signal Amber — the action colour. Paired with navy text (amber on white
// fails contrast — see docs/brand/BRAND.md).
const AMBER = '#F5A524';
const NAVY = '#101724';

interface BottomActionBarProps {
  onQuickGoal: () => void;
  onOtherEvent: () => void;
  /** Commit the staged substitutions (UX-007 branch 3). */
  onSubmit?: () => void;
  /** Number of substitutions staged; when > 0 Submit becomes the primary action. */
  pendingCount?: number;
  /** Oldest pending pair has waited 60s: give Submit a stronger static amber halo. */
  pendingCritical?: boolean;
  disabled?: boolean;
  className?: string;
}

export const BottomActionBar = forwardRef<HTMLDivElement, BottomActionBarProps>(
  function BottomActionBar(
    { onQuickGoal, onOtherEvent, onSubmit, pendingCount = 0, pendingCritical = false, disabled = false, className },
    ref,
  ) {
    const hasPending = pendingCount > 0;

    return (
      <div
        ref={ref}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
          'pb-[max(8px,env(safe-area-inset-bottom))]', // Safe area for notched devices
          className,
        )}
      >
        <div className="container px-4 py-3">
          <div className={cn('grid gap-3', hasPending ? 'grid-cols-3' : 'grid-cols-2')}>
            {/* Submit — only while subs are pending. Stays amber and does not move:
                the control a coach must hit under pressure must not change beneath
                their thumb. A soft static amber halo lifts it off the critical red. */}
            {hasPending && (
              <Button
                onClick={onSubmit}
                disabled={disabled}
                className="h-14 flex flex-col items-center justify-center gap-1 border-0 hover:brightness-95"
                style={{
                  backgroundColor: AMBER,
                  color: NAVY,
                  boxShadow: pendingCritical
                    ? `0 0 22px 3px rgba(245, 165, 36, 0.75)`
                    : `0 0 14px 1px rgba(245, 165, 36, 0.55)`,
                }}
              >
                <Check className="h-5 w-5" />
                <span className="text-xs font-semibold">Submit ({pendingCount})</span>
              </Button>
            )}

            {/* Goal — primary when nothing is pending, secondary when Submit takes over. */}
            <Button
              onClick={onQuickGoal}
              disabled={disabled}
              variant={hasPending ? 'outline' : 'default'}
              className={cn(
                'h-14 flex flex-col items-center justify-center gap-1',
                !hasPending &&
                  'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
              )}
            >
              <Goal className="h-5 w-5" />
              <span className="text-xs font-semibold">Goal</span>
            </Button>

            {/* Other Event */}
            <Button
              onClick={onOtherEvent}
              disabled={disabled}
              variant="outline"
              className="h-14 flex flex-col items-center justify-center gap-1"
            >
              <Target className="h-5 w-5" />
              <span className="text-xs font-semibold">Event</span>
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
