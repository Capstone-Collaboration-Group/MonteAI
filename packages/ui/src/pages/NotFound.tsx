import * as React from "react";

interface NotFoundProps {
  onGoHome?: () => void;
}

export function NotFound({ onGoHome }: NotFoundProps) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-6xl font-medium text-primary">404</p>
      <h1 className="text-lg font-medium text-on-surface">Page not found</h1>
      <p className="max-w-sm text-sm text-on-surface-variant">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      {onGoHome && (
        <button
          onClick={onGoHome}
          className="mt-2 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container hover:opacity-90"
        >
          Back to home
        </button>
      )}
    </div>
  );
}