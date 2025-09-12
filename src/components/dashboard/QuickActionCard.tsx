import { memo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: string;
  action: string;
  onClick: () => void;
}

export const QuickActionCard = memo(({
  title,
  description,
  icon: IconComponent,
  color,
  action,
  onClick,
}: QuickActionCardProps) => {
  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20"
      onClick={onClick}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-lg ${color} text-white`}>
            <IconComponent className="h-6 w-6" />
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-base">
          {description}
        </CardDescription>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3 self-start group-hover:bg-primary group-hover:text-primary-foreground"
        >
          {action}
        </Button>
      </CardHeader>
    </Card>
  );
});

QuickActionCard.displayName = 'QuickActionCard';