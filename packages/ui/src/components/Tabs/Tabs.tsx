import { createContext, useContext, useState, type ReactNode } from "react";

export type TabsVariant = "line" | "pills" | "enclosed";
interface TabsContextProps { activeTab: string; setActiveTab: (v: string) => void; variant: TabsVariant; }

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs sub-components must be rendered within a Tabs provider");
  return ctx;
}

export interface TabsProps { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; variant?: TabsVariant; children: ReactNode; className?: string; }

export function Tabs({ value, defaultValue = "", onValueChange, variant = "line", children, className = "" }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = value ?? internalTab;

  const setActiveTab = (val: string) => {
    if (value === undefined) setInternalTab(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={`w-full flex flex-col gap-4 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}
