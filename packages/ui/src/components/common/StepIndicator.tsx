import type { HTMLAttributes } from "react";

interface StepIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  steps: string[];
  activeStep: number;
}

export function StepIndicator({
  steps,
  activeStep,
  className = "",
  ...props
}: StepIndicatorProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`} {...props}>
      {steps.map((label, index) => {
        const complete = index < activeStep;
        const active = index === activeStep;

        return (
          <div key={label} className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${complete ? "bg-emerald-600 border-emerald-600 text-white" : active ? "bg-sky-600 border-sky-600 text-white" : "border-slate-300 text-slate-700"}`}
            >
              {index + 1}
            </div>
            <div className="min-w-[8rem] text-sm">
              <div
                className={`font-medium ${active ? "text-slate-900" : "text-slate-500"}`}
              >
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
