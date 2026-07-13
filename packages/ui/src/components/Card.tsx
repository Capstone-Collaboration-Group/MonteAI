import type { HTMLAttributes } from "react";

// packages/ui/src/components/Card.tsx
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-outline-variant bg-surface-container-low shadow-sm p-4 ${className}`}
      {...props}
    />
  );
}