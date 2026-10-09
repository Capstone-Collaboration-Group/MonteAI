import { Skeleton } from "../../common";

export function ResearchGroupViewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="rectangular" height={88} className="rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={44} height={44} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </div>
            </div>
            <Skeleton variant="text" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={72} className="rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
