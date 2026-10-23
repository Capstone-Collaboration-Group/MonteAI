import {
  createContext,
  useContext,
} from "react";

export type TabsVariant = "line" | "pills" | "enclosed";

interface TabsContextProps {
  activeTab: string;
  setActiveTab: (v: string) => void;
  variant: TabsVariant;
}

export const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs sub-components must be rendered within a Tabs provider");
  return ctx;
}