// packages/ui/src/components/Thesis/ThesisPDFViewerSkeleton.tsx
import { Skeleton } from "../../common/Skeleton";
import { PageLayout } from "../../common";
import { AnnotationSidebarSkeleton } from "../skeletons/AnnotationSideBarSkeleton";

export function ThesisPDFViewerSkeleton({ onBack }: { onBack?: () => void }) {
  return (
    <PageLayout>
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <Skeleton variant="rectangular" width={72} height={32} animation="shimmer" className="rounded-lg" />
          )}
          <div className="h-5 w-px bg-outline-variant" />
          <Skeleton variant="text" width={140} height={22} animation="shimmer" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" width={130} height={36} animation="shimmer" className="rounded-lg" />
          <Skeleton variant="rectangular" width={160} height={36} animation="shimmer" className="rounded-lg" />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF panel */}
        <main className="flex flex-1 flex-col">
          {/* PDF toolbar */}
          <div className="flex items-center justify-between border-b border-outline-variant bg-surface px-4 py-2">
            <div className="flex items-center gap-2">
              <Skeleton variant="circular" width={28} height={28} animation="shimmer" />
              <Skeleton variant="text" width={60} height={16} animation="shimmer" />
              <Skeleton variant="circular" width={28} height={28} animation="shimmer" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="rectangular" width={56} height={28} animation="shimmer" className="rounded-md" />
              <Skeleton variant="text" width={40} height={14} animation="shimmer" />
              <Skeleton variant="rectangular" width={56} height={28} animation="shimmer" className="rounded-md" />
            </div>
          </div>

          {/* PDF page placeholder */}
          <div className="flex flex-1 items-center justify-center bg-surface-container-low px-6 py-6">
            <Skeleton
              variant="rectangular"
              width={640}
              height={820}
              animation="shimmer"
              className="rounded-lg shadow-lg"
            />
          </div>
        </main>

        {/* Annotation sidebar */}
        <aside className="w-80 shrink-0 border-l border-outline-variant bg-surface">
          <AnnotationSidebarSkeleton />
        </aside>
      </div>
    </PageLayout>
  );
}