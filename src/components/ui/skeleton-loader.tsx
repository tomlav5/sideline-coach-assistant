import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function MatchTrackerSkeleton() {
  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 max-w-4xl">
      {/* Header Skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-8">
              <Skeleton className="h-16 w-16" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-16 w-16" />
            </div>
            <Skeleton className="h-6 w-32 mx-auto" />
          </div>
        </CardContent>
      </Card>

      {/* Controls Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>

      {/* Actions Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

export function PlayerListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
