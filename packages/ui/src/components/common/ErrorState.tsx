import { useState } from "react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "An error occurred",
  message = "We encountered a problem while processing your request.",
  details,
  onRetry,
  className = "",
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-status-critical/5 border border-status-critical/20 ${className}`}
    >
      <div className="mb-4 p-3.5 rounded-full bg-status-critical/10 text-status-critical dark:text-status-critical">
        <svg
          className="w-9 h-9"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-on-surface mb-1">{title}</h3>
      <p className="text-sm text-on-surface-variant max-w-md mb-5 leading-relaxed">
        {message}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-status-critical hover:bg-status-critical/90 text-white transition-colors cursor-pointer shadow-xs"
          >
            Try Again
          </button>
        )}
        {details && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 text-sm font-medium rounded-lg text-on-surface-variant hover:text-on-surface bg-surface-container-high/60 transition-colors cursor-pointer"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        )}
      </div>
      {details && showDetails && (
        <div className="mt-4 w-full max-w-md p-3 rounded-lg bg-surface-container-high/80 text-xs font-mono text-left text-on-surface-variant overflow-x-auto border border-outline/10">
          <pre className="whitespace-pre-wrap break-all">{details}</pre>
        </div>
      )}
    </div>
  );
}
