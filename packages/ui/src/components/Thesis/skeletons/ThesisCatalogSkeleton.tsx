// packages/ui/src/components/Thesis/ThesisCatalogSkeleton.tsx
import { Skeleton } from "../../common/Skeleton";
import { PageLayout } from "../../common";

function FeaturedThesisCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-outline-variant bg-surface p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <Skeleton variant="text" width="70%" height={24} animation="shimmer" />
        <Skeleton variant="rectangular" width={80} height={24} animation="shimmer" className="rounded-full shrink-0" />
      </div>
      <div className="mt-3 flex gap-4">
        <Skeleton variant="text" width={160} height={16} animation="shimmer" />
        <Skeleton variant="text" width={100} height={16} animation="shimmer" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton variant="text" width="100%" height={14} animation="shimmer" />
        <Skeleton variant="text" width="80%" height={14} animation="shimmer" />
      </div>
      <div className="mt-auto pt-6">
        <Skeleton variant="rectangular" width={120} height={36} animation="shimmer" className="rounded-lg" />
      </div>
    </div>
  );
}

function SubmissionHealthCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-primary/10 p-6">
      <Skeleton variant="text" width={140} height={12} animation="shimmer" />
      <Skeleton variant="text" width={100} height={40} animation="shimmer" className="mt-3" />
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton variant="text" width="100%" height={12} animation="shimmer" />
        <Skeleton variant="text" width="85%" height={12} animation="shimmer" />
      </div>
      <div className="mt-auto pt-8">
        <Skeleton variant="rectangular" width="100%" height={2} animation="shimmer" />
        <div className="mt-2 flex justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" width={16} height={10} animation="shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThesisListRowSkeleton() {
  return (
    <tr className="border-t border-outline-variant">
      <td className="px-6 py-4">
        <Skeleton variant="text" width="80%" height={16} animation="shimmer" />
        <Skeleton variant="text" width="50%" height={12} animation="shimmer" className="mt-1.5" />
      </td>
      <td className="px-6 py-4">
        <Skeleton variant="text" width={140} height={14} animation="shimmer" />
      </td>
      <td className="px-6 py-4">
        <Skeleton variant="rectangular" width={80} height={24} animation="shimmer" className="rounded-full" />
      </td>
      <td className="px-6 py-4">
        <Skeleton variant="text" width={90} height={14} animation="shimmer" />
      </td>
      <td className="px-6 py-4 text-right">
        <Skeleton variant="circular" width={28} height={28} animation="shimmer" className="ml-auto" />
      </td>
    </tr>
  );
}

function ThesisListSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface">
      <div className="flex items-center justify-between border-b border-outline-variant px-6 py-5">
        <Skeleton variant="text" width={180} height={22} animation="shimmer" />
        <Skeleton variant="rectangular" width={72} height={32} animation="shimmer" className="rounded-lg" />
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <th className="px-6 py-3 font-medium">Title</th>
            <th className="px-6 py-3 font-medium">Authors</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Date</th>
            <th className="px-6 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <ThesisListRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ThesisCatalogSkeleton() {
  return (
    <PageLayout className="overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton variant="text" width={120} height={12} animation="shimmer" />
            <Skeleton variant="text" width={200} height={32} animation="shimmer" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton variant="rectangular" width={320} height={40} animation="shimmer" className="rounded-full" />
            <Skeleton variant="rectangular" width={140} height={40} animation="shimmer" className="rounded-full" />
          </div>
        </div>

        {/* Subtitle */}
        <Skeleton variant="text" width={300} height={14} animation="shimmer" />

        {/* Featured + Health cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <FeaturedThesisCardSkeleton />
          <SubmissionHealthCardSkeleton />
        </div>

        {/* List */}
        <ThesisListSkeleton />
      </div>
    </PageLayout>
  );
}