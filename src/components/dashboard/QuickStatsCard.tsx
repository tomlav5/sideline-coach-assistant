import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface QuickStatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
  textColors: string;
  hoverColors: string;
  onClick: () => void;
}

export const QuickStatsCard = memo(({
  title,
  value,
  icon: IconComponent,
  gradient,
  textColors,
  hoverColors,
  onClick,
}: QuickStatsCardProps) => {
  return (
    <Card 
      className={`${gradient} cursor-pointer hover:shadow-lg transition-all duration-300 group border-2 hover:border-primary/20`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6 text-center">
        <div className={`text-2xl sm:text-3xl font-bold ${textColors} group-hover:scale-110 transition-transform`}>
          {value}
        </div>
        <div className={`text-sm ${textColors} mt-1 ${hoverColors}`}>
          {title}
        </div>
        <div className={`text-xs ${textColors} mt-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
          Click to view all →
        </div>
      </CardContent>
    </Card>
  );
});

QuickStatsCard.displayName = 'QuickStatsCard';