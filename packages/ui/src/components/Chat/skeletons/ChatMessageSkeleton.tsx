import { Skeleton } from "../../common/Skeleton";

export function ChatPageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 pt-12">
          <Skeleton
            variant="rectangular"
            width="68%"
            height={64}
            animation="pulse"
            className="rounded-2xl bg-slate-300"
          />
          <Skeleton
            variant="rectangular"
            width="82%"
            height={92}
            animation="pulse"
            className="rounded-2xl bg-slate-300"
          />
          <Skeleton
            variant="rectangular"
            width="55%"
            height={64}
            animation="pulse"
            className="rounded-2xl bg-slate-300"
          />
        </div>
      </div>
      <div className="border-t border-outline-variant bg-surface-container-low px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <Skeleton
            variant="rectangular"
            width="100%"
            height={52}
            animation="pulse"
            className="rounded-full bg-slate-300"
          />
        </div>
      </div>
      <div className="mb-5 mt-3 flex justify-center">
        <Skeleton
          variant="text"
          width={250}
          height={12}
          animation="pulse"
          className="bg-slate-300"
        />
      </div>
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="mr-auto flex max-w-[80%] flex-col gap-2 rounded-2xl bg-surface-container px-4 py-3">
      <Skeleton
        variant="text"
        width={220}
        height={14}
        animation="pulse"
        className="bg-slate-300"
      />
      <Skeleton
        variant="text"
        width={150}
        height={14}
        animation="pulse"
        className="bg-slate-300"
      />
    </div>
  );
}
