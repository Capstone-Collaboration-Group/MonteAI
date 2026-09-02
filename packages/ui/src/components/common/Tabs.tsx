import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type ElementType,
} from "react";
import { cn } from "@monteai/utils"; // adjust if your cn() lives elsewhere

// ─── Context ─────────────────────────────────────────────────────────────────

export type TabsVariant = "line" | "pills" | "enclosed";

interface TabsContextProps {
  activeTab: string;
  setActiveTab: (v: string) => void;
  variant: TabsVariant;
}

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs sub-components must be rendered within a Tabs provider");
  return ctx;
}

// ─── Tabs (provider) ─────────────────────────────────────────────────────────

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  variant?: TabsVariant;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  variant = "line",
  children,
  className = "",
}: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = value ?? internalTab;

  const setActiveTab = (val: string) => {
    if (value === undefined) setInternalTab(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={cn("w-full flex flex-col gap-4", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ─── TabsList ────────────────────────────────────────────────────────────────

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  const { variant } = useTabsContext();

  const base = "flex items-center";
  const variantCls: Record<TabsVariant, string> = {
    line: "gap-0 border-b border-outline-variant",
    pills: "gap-3",
    enclosed: "gap-0 border border-outline-variant rounded-xl p-1 w-fit",
  };

  return (
    <div className={cn(base, variantCls[variant], className)}>
      {children}
    </div>
  );
}

// ─── TabsTrigger ─────────────────────────────────────────────────────────────

export interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  /** Lucide icon component */
  icon?: ElementType;
  /** Badge count shown as a pill */
  badge?: number | string;
  className?: string;
  onClick?: () => void;
}

export function TabsTrigger({
  value,
  children,
  icon: Icon,
  badge,
  className,
  onClick,
}: TabsTriggerProps) {
  const { activeTab, setActiveTab, variant } = useTabsContext();
  const isActive = activeTab === value;

  const base =
    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const variantCls: Record<TabsVariant, { root: string; active: string; inactive: string }> = {
    line: {
      root: "px-3 py-2 border-b-2 -mb-px rounded-none",
      active: "border-primary text-primary",
      inactive: "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline",
    },
    pills: {
      root: "px-3 py-1.5 rounded-full",
      active: "bg-primary text-on-primary",
      inactive: "text-on-surface-variant hover:bg-surface-variant hover:text-on-surface",
    },
    enclosed: {
      root: "px-3 py-1.5 rounded-lg",
      active: "bg-surface text-on-surface shadow-sm",
      inactive: "text-on-surface-variant hover:text-on-surface",
    },
  };

  const { root, active, inactive } = variantCls[variant];

  return (
    <button
      type="button"
      className={cn(base, root, isActive ? active : inactive, className)}
      onClick={() => {
        setActiveTab(value);
        onClick?.();
      }}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {badge !== undefined && (
        <span
          className={cn(
            "ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            isActive
              ? "bg-on-primary/20"
              : "bg-on-surface-variant/20 text-on-surface-variant",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── TabsContent ─────────────────────────────────────────────────────────────

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;
  return <div className={className}>{children}</div>;
}