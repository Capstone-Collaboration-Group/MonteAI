import { Skeleton } from "../../common/Skeleton";

export function ScheduleCalendarSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface">
      <header className="flex h-16 items-center justify-between border-b border-outline-variant px-6">
        <div className="flex items-center gap-4">
          <Skeleton
            variant="text"
            width={160}
            height={24}
            animation="shimmer"
          />
          <Skeleton
            variant="rectangular"
            width={220}
            height={34}
            animation="shimmer"
            className="rounded-lg"
          />
          <Skeleton
            variant="rectangular"
            width={160}
            height={34}
            animation="shimmer"
            className="rounded-lg"
          />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton
            variant="text"
            width={190}
            height={16}
            animation="shimmer"
          />
          <Skeleton
            variant="rectangular"
            width={72}
            height={34}
            animation="shimmer"
            className="rounded-lg"
          />
          <Skeleton
            variant="rectangular"
            width={72}
            height={34}
            animation="shimmer"
            className="rounded-lg"
          />
        </div>
      </header>
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-6 border-b border-outline-variant">
          <Skeleton
            variant="rectangular"
            height={64}
            animation="shimmer"
            className="rounded-none border-r border-outline-variant"
          />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 border-r border-outline-variant p-4"
            >
              <Skeleton
                variant="text"
                width={40}
                height={12}
                animation="shimmer"
              />
              <Skeleton
                variant="text"
                width={24}
                height={24}
                animation="shimmer"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6">
          <div className="border-r border-outline-variant pt-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-[60px] border-t border-outline-variant/40 px-2 pt-1"
              >
                <Skeleton
                  variant="text"
                  width={48}
                  height={12}
                  animation="shimmer"
                />
              </div>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[720px] border-r border-outline-variant"
            >
              {Array.from({ length: 12 }).map((__, row) => (
                <div
                  key={row}
                  className="h-[60px] border-t border-outline-variant/40"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
