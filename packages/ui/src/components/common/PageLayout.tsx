// packages/ui/src/components/PageLayout.tsx
import type { HTMLAttributes, ReactNode } from "react";

interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  direction?: "col" | "row";
}

export function PageLayout({ 
  children, 
  className = "", 
  direction = "col", 
  ...props 
}: PageLayoutProps) {
  // Determine layout orientation dynamically
  const layoutClass = direction === "col" ? "flex-col" : "flex-row";
  
  return (
    <div 
      className={`flex h-full bg-surface-container-low ${layoutClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}