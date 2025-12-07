import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Undo2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoButtonProps {
  canUndo: boolean;
  isUndoing: boolean;
  remainingSeconds: number;
  description?: string;
  onUndo: () => void;
  className?: string;
}

export function UndoButton({
  canUndo,
  isUndoing,
  remainingSeconds,
  description,
  onUndo,
  className,
}: UndoButtonProps) {
  if (!canUndo) return null;

  const progressPercent = (remainingSeconds / 30) * 100;

  return (
    <Card className={cn(
      "fixed bottom-20 right-4 z-50 shadow-lg border-2 border-orange-500 dark:border-orange-600",
      "animate-in slide-in-from-bottom-5 duration-300",
      className
    )}>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {description || 'Action recorded'}
            </p>
            <p className="text-xs text-muted-foreground">
              {remainingSeconds}s remaining
            </p>
          </div>
          <Button
            onClick={onUndo}
            disabled={isUndoing}
            size="sm"
            variant="destructive"
            className="flex-shrink-0 h-10 px-4"
          >
            {isUndoing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Undo2 className="h-4 w-4 mr-2" />
                Undo
              </>
            )}
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 dark:bg-orange-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
