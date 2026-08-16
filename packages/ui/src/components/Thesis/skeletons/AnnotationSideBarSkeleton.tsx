// packages/ui/src/components/Thesis/AnnotationSidebarSkeleton.tsx
import { Skeleton } from "../../common/Skeleton";

function AnnotationCardSkeleton() {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton variant="rectangular" width={60} height={20} animation="shimmer" className="rounded-md" />
        <Skeleton variant="text" width={80} height={12} animation="shimmer" />
      </div>
      <Skeleton variant="text" width="90%" height={12} animation="shimmer" className="mb-2" />
      <div className="mb-3 flex flex-col gap-1.5">
        <Skeleton variant="text" width="100%" height={14} animation="shimmer" />
        <Skeleton variant="text" width="75%" height={14} animation="shimmer" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={100} height={12} animation="shimmer" />
        <Skeleton variant="circular" width={24} height={24} animation="shimmer" />
      </div>
    </div>
  );
}

export function AnnotationSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-outline-variant px-5 py-4">
        <Skeleton variant="text" width={160} height={20} animation="shimmer" />
        <div className="mt-2 flex gap-3">
          <Skeleton variant="text" width={80} height={12} animation="shimmer" />
          <Skeleton variant="text" width={70} height={12} animation="shimmer" />
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <AnnotationCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}