import { SubmissionHealthStatus } from "@monteai/types";

interface SubmissionHealthCardProps {
  stats: SubmissionHealthStatus;
}

const TICKS = [0, 25, 50, 75, 100];

export function SubmissionHealthCard({ stats }: SubmissionHealthCardProps) {
  const pct = Math.max(0, Math.min(100, stats.approvalRate));

  return (
    <div className="flex h-full flex-col rounded-2xl bg-primary p-6 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        Submission Health
      </p>

      <p className="mt-3 font-serif text-4xl font-semibold leading-none">
        {pct}%
        <span className="ml-2 align-middle text-base font-sans font-normal text-on-surface-variant">
          Approval
        </span>
      </p>

      <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
        {stats.note ??
          `Historical data shows a high standard of peer-reviewed content for ${stats.yearLabel}.`}
      </p>

      {/* Ledger progress: a ruled line with tick marks, evoking a bound registry */}
      <div className="mt-auto pt-8">
        <div className="relative h-px w-full bg-outline">
          <div
            className="absolute inset-y-0 left-0 h-px bg-secondary"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute -top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-secondary"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between">
          {TICKS.map((t) => (
            <span key={t} className="text-[10px] font-medium text-outline">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
