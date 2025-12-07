import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartSuggestionBadgeProps {
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
  className?: string;
}

export function SmartSuggestionBadge({
  confidence,
  reason,
  className,
}: SmartSuggestionBadgeProps) {
  const colors = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'flex items-center gap-1 text-xs',
        colors[confidence],
        className
      )}
      title={reason}
    >
      <Sparkles className="h-3 w-3" />
      Suggested
    </Badge>
  );
}
