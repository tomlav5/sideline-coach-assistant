import { Suspense, ReactNode, memo, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface OptimizedLazyLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
  skeletonType?: 'dashboard' | 'list' | 'form' | 'table';
}

const SkeletonFallbacks = {
  dashboard: (
    <div className="p-4 sm:p-6 space-y-6 animate-pulse">
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  ),
  list: (
    <div className="p-4 space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  ),
  form: (
    <div className="p-4 space-y-6 animate-pulse">
      <Skeleton className="h-8 w-64" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  ),
  table: (
    <div className="p-4 space-y-4 animate-pulse">
      <Skeleton className="h-8 w-48" />
      <div className="border rounded-lg">
        <div className="grid grid-cols-4 gap-4 p-4 border-b">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
};

export const OptimizedLazyLoader = memo(({ 
  children, 
  fallback, 
  skeletonType = 'dashboard' 
}: OptimizedLazyLoaderProps) => {
  const memoizedFallback = useMemo(() => {
    if (fallback) return fallback;
    return SkeletonFallbacks[skeletonType];
  }, [fallback, skeletonType]);

  return (
    <Suspense fallback={memoizedFallback}>
      {children}
    </Suspense>
  );
});

OptimizedLazyLoader.displayName = 'OptimizedLazyLoader';