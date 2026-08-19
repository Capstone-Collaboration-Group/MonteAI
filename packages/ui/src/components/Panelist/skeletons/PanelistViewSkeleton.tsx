import { Skeleton } from "../../common/Skeleton";

export function PanelistViewSkeleton() {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Skeleton
              variant="text"
              width={150}
              height={12}
              animation="shimmer"
            />
            <Skeleton
              variant="text"
              width={180}
              height={32}
              animation="shimmer"
            />
          </div>
          <div className="flex gap-3">
            <Skeleton
              variant="rectangular"
              width={320}
              height={40}
              animation="shimmer"
              className="rounded-full"
            />
            <Skeleton
              variant="rectangular"
              width={130}
              height={40}
              animation="shimmer"
              className="rounded-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rectangular"
              height={92}
              animation="shimmer"
              className="rounded-xl"
            />
          ))}
        </div>
        <Skeleton
          variant="rectangular"
          width={250}
          height={42}
          animation="shimmer"
          className="rounded-full"
        />
        <div className="overflow-hidden rounded-xl bg-surface">
          <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-6">
            <Skeleton
              variant="text"
              width={210}
              height={22}
              animation="shimmer"
            />
            <Skeleton
              variant="text"
              width={360}
              height={14}
              animation="shimmer"
            />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-4 items-center gap-6 border-b border-outline-variant/40 px-6 py-5"
            >
              <div className="flex items-center gap-3">
                <Skeleton
                  variant="circular"
                  width={40}
                  height={40}
                  animation="shimmer"
                />
                <div className="flex flex-col gap-2">
                  <Skeleton
                    variant="text"
                    width={140}
                    height={14}
                    animation="shimmer"
                  />
                  <Skeleton
                    variant="text"
                    width={110}
                    height={12}
                    animation="shimmer"
                  />
                </div>
              </div>
              <Skeleton
                variant="text"
                width={90}
                height={14}
                animation="shimmer"
              />
              <Skeleton
                variant="text"
                width={130}
                height={14}
                animation="shimmer"
              />
              <Skeleton
                variant="rectangular"
                width={100}
                height={24}
                animation="shimmer"
                className="rounded-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
