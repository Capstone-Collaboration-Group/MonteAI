import type { HTMLAttributes } from "react";

interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
  steps: string[];
  currentStep: number;
}

export function Timeline({
  steps,
  currentStep,
  className = "",
  ...props
}: TimelineProps) {
  return (
    <div className={`space-y-4 ${className}`} {...props}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;

        return (
          <div key={step} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`h-3.5 w-3.5 rounded-full ${isComplete ? "bg-emerald-500" : isActive ? "bg-sky-500" : "bg-slate-300"}`}
              />
              {index < steps.length - 1 && (
                <div className="h-full w-px flex-1 bg-slate-200" />
              )}
            </div>
            <div>
              <div
                className={`text-sm font-semibold ${isActive ? "text-slate-900" : "text-slate-600"}`}
              >
                {step}
              </div>
              <p className="text-xs text-slate-500">
                {isComplete
                  ? "Completed"
                  : isActive
                    ? "In progress"
                    : "Pending"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
