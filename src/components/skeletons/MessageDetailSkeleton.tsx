import { Skeleton } from '@/components/ui/skeleton';

export const MessageDetailSkeleton = () => {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
};
