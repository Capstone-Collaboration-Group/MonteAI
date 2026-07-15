import { createContext, useContext } from "react";

interface SidebarContextValue {
  collapsed: boolean;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("Sidebar.* components must be used within <Sidebar>");
  }
  return ctx;
}