import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Floodlight — see docs/brand/BRAND.md. Scoped locally, per the precedent set by the
// header/tile-grid branches (DESIGN-002 covers the app-wide token migration). This is
// a decoration, not the primary action, so confidence is conveyed by weight (navy vs
// Slate, full vs muted), never by amber — that stays reserved for the one real action
// on screen.
const FLOODLIGHT = { navy: '#101724', slate: '#5A6474', edge: '#CBD3DC', card: '#FFFFFF' };

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
  const styles: Record<typeof confidence, React.CSSProperties> = {
    high: { backgroundColor: FLOODLIGHT.card, color: FLOODLIGHT.navy, borderColor: FLOODLIGHT.navy },
    medium: { backgroundColor: FLOODLIGHT.card, color: FLOODLIGHT.slate, borderColor: FLOODLIGHT.edge },
    low: { backgroundColor: FLOODLIGHT.card, color: FLOODLIGHT.slate, borderColor: FLOODLIGHT.edge, opacity: 0.7 },
  };

  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1 text-xs', className)}
      style={styles[confidence]}
      title={reason}
    >
      <Sparkles className="h-3 w-3" />
      Suggested
    </Badge>
  );
}
