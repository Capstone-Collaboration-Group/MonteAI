import type { ReactNode } from "react";
import { useTabsContext } from "./Tabs";

const listVariants = {
  line: "border-b border-outline/20 gap-6",
  pills: "gap-2 p-1 bg-surface-container-high/40 rounded-xl",
  enclosed:
    "gap-1 p-1 bg-surface-container-low rounded-xl border border-outline/15",
};

export function TabList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { variant } = useTabsContext();
  return (
    <div
      className={`flex items-center overflow-x-auto ${listVariants[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

export function TabTrigger({
  value,
  children,
  icon,
  badge,
  disabled = false,
  className = "",
}: {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { activeTab, setActiveTab, variant } = useTabsContext();
  const active = activeTab === value;

  const triggerVariants = {
    line: active
      ? "text-primary-container dark:text-status-approved border-b-2 border-primary-container dark:border-status-approved font-semibold py-2.5"
      : "text-on-surface-variant hover:text-on-surface border-b-2 border-transparent py-2.5",
    pills: active
      ? "bg-primary-container text-white font-medium rounded-lg shadow-xs py-2 px-3.5"
      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60 rounded-lg py-2 px-3.5",
    enclosed: active
      ? "bg-surface text-on-surface shadow-xs font-semibold rounded-lg py-2 px-3.5 border border-outline/10"
      : "text-on-surface-variant hover:text-on-surface rounded-lg py-2 px-3.5",
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={`inline-flex items-center gap-2 text-sm transition-all whitespace-nowrap cursor-pointer disabled:opacity-40 ${triggerVariants[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </button>
  );
}

export function TabContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;
  return (
    <div
      role="tabpanel"
      className={`animate-in fade-in-50 duration-150 ${className}`}
    >
      {children}
    </div>
  );
}
