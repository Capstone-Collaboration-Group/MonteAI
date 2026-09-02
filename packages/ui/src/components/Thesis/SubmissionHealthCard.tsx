import { SubmissionHealthStatus } from "@monteai/types";

interface SubmissionHealthCardProps {
  stats: SubmissionHealthStatus;
}

const TICKS = [0, 25, 50, 75, 100];

export function SubmissionHealthCard({ stats }: SubmissionHealthCardProps) {
  const pct = Math.max(0, Math.min(100, stats.approvalRate));

  return (
  <div className="flex h-full flex-col rounded-2xl bg-primary p-6">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/60">
      Submission Health
    </p>

    <p className="mt-3 font-serif text-4xl font-semibold leading-none text-on-primary">
      {pct}%
      <span className="ml-2 align-middle text-base font-sans font-normal text-on-primary/75">
        Approval
      </span>
    </p>

    <p className="mt-3 text-sm leading-relaxed text-on-primary/75">
      {stats.note ??
        `Historical data shows a high standard of peer-reviewed content for ${stats.yearLabel}.`}
    </p>

    <div className="mt-auto pt-8">
      <div className="relative h-px w-full bg-on-primary/20">
        <div
          className="absolute inset-y-0 left-0 h-px bg-on-primary-container"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute -top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-on-primary-container"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between">
        {TICKS.map((t) => (
          <span key={t} className="text-[10px] font-medium text-on-primary/50">
            {t}
          </span>
        ))}
      </div>
    </div>
  </div>
);
}
