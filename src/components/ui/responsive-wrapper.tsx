import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveWrapperProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'mobile-first' | 'desktop-centered';
}

export function ResponsiveWrapper({ 
  children, 
  className,
  variant = 'default' 
}: ResponsiveWrapperProps) {
  const baseClasses = "w-full";
  
  const variantClasses = {
    'default': "container mx-auto px-4 sm:px-6 lg:px-8",
    'mobile-first': "px-4 sm:px-6 lg:px-8 max-w-full sm:max-w-7xl sm:mx-auto",
    'desktop-centered': "container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl"
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
    </div>
  );
}

export function MobileDialog({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mobile-dialog", className)}>
      {children}
    </div>
  );
}

export function TouchTarget({ children, className, ...props }: any) {
  return (
    <div className={cn("touch-target", className)} {...props}>
      {children}
    </div>
  );
}