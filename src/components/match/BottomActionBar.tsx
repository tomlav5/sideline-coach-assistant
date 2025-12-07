import { Button } from '@/components/ui/button';
import { Goal, ArrowUpDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomActionBarProps {
  onQuickGoal: () => void;
  onSubstitution: () => void;
  onOtherEvent: () => void;
  disabled?: boolean;
  className?: string;
}

export function BottomActionBar({
  onQuickGoal,
  onSubstitution,
  onOtherEvent,
  disabled = false,
  className,
}: BottomActionBarProps) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "pb-[max(8px,env(safe-area-inset-bottom))]", // Safe area for notched devices
      className
    )}>
      <div className="container px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          {/* Quick Goal - Primary Action */}
          <Button
            onClick={onQuickGoal}
            disabled={disabled}
            className="h-14 flex flex-col items-center justify-center gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
          >
            <Goal className="h-5 w-5" />
            <span className="text-xs font-semibold">Goal</span>
          </Button>

          {/* Substitution - Secondary Action */}
          <Button
            onClick={onSubstitution}
            disabled={disabled}
            variant="outline"
            className="h-14 flex flex-col items-center justify-center gap-1 border-yellow-600 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-500 dark:text-yellow-400 dark:hover:bg-yellow-950"
          >
            <ArrowUpDown className="h-5 w-5" />
            <span className="text-xs font-semibold">Sub</span>
          </Button>

          {/* Other Event - Tertiary Action */}
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
}
