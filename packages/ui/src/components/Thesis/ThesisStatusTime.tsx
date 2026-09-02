// packages/ui/src/components/Thesis/ThesisStatusTimeline.tsx
import { CheckCircle, Circle } from "lucide-react";
import type { ThesisResponseDto } from "@monteai/types";
import { HamburgerButton } from "../common/Hamburger";

interface TimelineStep {
  key: string;
  label: string;
  date: string | undefined;
  reached: boolean;
  isCurrent: boolean;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function buildTimeline(thesis: ThesisResponseDto): TimelineStep[] {
  const status = thesis.status?.toLowerCase() ?? "pending";

  const steps = [
    { key: "submitted", label: "Submitted", date: thesis.submittedAt },
    { key: "pending", label: "Pending", date: thesis.submittedAt },
    { key: "scheduled", label: "Scheduled", date: thesis.scheduledAt },
    { key: "revision", label: "Under Review", date: thesis.reviewedAt },
    { key: "approved", label: "Approved", date: thesis.approvedAt },
    { key: "rejected", label: "Rejected", date: thesis.rejectedAt },
    { key: "indexed", label: "Published", date: thesis.indexedAt },
  ];

  const filtered = steps.filter((s) => {
    if (s.key === "rejected" && status !== "rejected") return false;
    if (s.key === "approved" && status === "rejected") return false;
    if (s.key === "indexed" && status === "rejected") return false;
    return true;
  });

  const ORDER = [
    "submitted",
    "pending",
    "scheduled",
    "revision",
    "approved",
    "indexed",
    "rejected",
  ];
  const currentIndex = ORDER.indexOf(status);

  return filtered.map((s) => ({
    ...s,
    reached: ORDER.indexOf(s.key) <= currentIndex,
    isCurrent: s.key === status,
  }));
}

interface ThesisStatusTimelineProps {
  thesis: ThesisResponseDto;
  role: "adviser" | "program_head" | "student";
  isCollapsed: boolean;
  onToggle: () => void;
}

export function ThesisStatusTimeline({
  thesis,
  role,
  isCollapsed,
  onToggle,
}: ThesisStatusTimelineProps) {
  const timeline = buildTimeline(thesis);
  const isReviewer = role === "adviser" || role === "program_head";

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-outline-variant bg-white transition-all duration-300 ${
        isCollapsed ? "w-12" : "w-64"
      }`}
    >
      {isCollapsed ? (
        /* ── Collapsed ── */
        <div
          role="button"
          aria-label="Expand panel"
          onClick={onToggle}
          className="flex flex-1 cursor-pointer flex-col items-center py-4 transition-colors hover:bg-surface-container-low"
        >
          <HamburgerButton
            isOpen={false}
            onToggle={onToggle}
            size="sm"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex flex-1 items-center justify-center">
            <span
              className="text-xs font-semibold uppercase tracking-widest text-outline"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }}
            >
              Timeline
            </span>
          </div>
        </div>
      ) : (
        /* ── Expanded ── */
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Header row with hamburger */}
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-outline">
              Timeline
            </span>
            <HamburgerButton isOpen={true} onToggle={onToggle} size="sm" />
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
            {/* Mode indicator */}
            <div className="rounded-lg bg-surface-container-low px-3 py-2">
              <p className="text-xs font-semibold text-on-surface-variant">
                {isReviewer ? "Reviewer Mode" : "View Only"}
              </p>
              <p className="mt-0.5 text-xs text-outline">
                {isReviewer ? "Reviewer Mode (enabled)" : "View only"}
              </p>
            </div>

            {/* Thesis title */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-outline">
                Thesis Status Timeline
              </p>
              <p className="text-xs font-medium leading-snug text-on-surface line-clamp-2">
                {thesis.title ?? "Untitled"}
              </p>
            </div>

            {/* Steps */}
            <div className="flex flex-col">
              {timeline.map((step, idx) => {
                const isLast = idx === timeline.length - 1;
                const dt = step.date ? formatDateTime(step.date) : null;

                return (
                  <div key={step.key} className="relative flex gap-3">
                    {!isLast && (
                      <div
                        className={`absolute left-[9px] top-5 h-full w-px ${
                          step.reached ? "bg-primary" : "bg-outline-variant"
                        }`}
                      />
                    )}

                    <div className="relative z-10 mt-0.5 shrink-0">
                      {step.reached ? (
                        <CheckCircle
                          className={`h-[18px] w-[18px] ${
                            step.isCurrent ? "text-primary" : "text-primary"
                          }`}
                        />
                      ) : (
                        <Circle className="h-[18px] w-[18px] text-outline-variant" />
                      )}
                    </div>

                    <div className={`${isLast ? "pb-0" : "pb-5"}`}>
                      <p
                        className={`text-sm font-semibold leading-none ${
                          step.isCurrent
                            ? "text-primary"
                            : step.reached
                              ? "text-on-surface-variant"
                              : "text-outline"
                        }`}
                      >
                        {step.label}
                      </p>
                      {dt ? (
                        <>
                          <p className="mt-0.5 text-xs text-outline">
                            {dt.date}
                          </p>
                          <p className="text-xs text-outline">{dt.time}</p>
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs text-outline">—</p>
                      )}
                      {step.isCurrent && (
                        <span className="mt-2 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {step.label === "Approved"
                            ? "Formally accepted"
                            : step.label === "Rejected"
                              ? "Thesis rejected"
                              : `Currently ${step.label.toLowerCase()}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reviewer notes */}
            {isReviewer && (
              <div className="rounded-lg border border-outline-variant bg-surface px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-on-surface">
                    Reviewer Notes (Private)
                  </p>
                </div>
                <p className="mt-1 text-xs text-outline">
                  Only you can see these notes
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
