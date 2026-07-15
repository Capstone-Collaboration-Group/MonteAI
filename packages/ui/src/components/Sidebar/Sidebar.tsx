import * as React from "react";
import { SidebarContext, useSidebarContext } from "./SidebarContext";

// ---------- Root ----------
interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
}

function Sidebar({ collapsed = false, className = "", children, ...props }: SidebarProps) {
  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <aside
        data-collapsed={collapsed}
        className={`flex h-full flex-col border-r border-border bg-background transition-all duration-200 ${
          collapsed ? "w-16" : "w-64"
        } ${className}`}
        {...props}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

// ---------- Header (logo, window controls, whatever the app needs) ----------
function SidebarHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex h-14 shrink-0 items-center px-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

// ---------- Nav (scrollable item list) ----------
function SidebarNav({ className = "", children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={`flex flex-1 flex-col gap-1 overflow-y-auto p-2 ${className}`} {...props}>
      {children}
    </nav>
  );
}

// ---------- Item ----------
interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function SidebarItem({ icon, label, active = false, className = "", ...props }: SidebarItemProps) {
  const { collapsed } = useSidebarContext();

  return (
    <button
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
            ? "bg-primary-container text-surface-container font-medium"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
      } ${collapsed ? "justify-center" : ""} ${className}`}
      {...props}
    >
      <span className="shrink-0 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

// ---------- Footer (user profile, settings, etc) ----------
function SidebarFooter({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`border-t border-border p-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

// ---------- Toggle ----------
interface SidebarToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onToggle: () => void;
}

function SidebarToggle({ onToggle, className = "", ...props }: SidebarToggleProps) {
  const { collapsed } = useSidebarContext();
  return (
    <button
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted ${className}`}
      {...props}
    >
      {collapsed ? "»" : "«"}
    </button>
  );
}

function SidebarNewChatButton({ className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition-opacity hover:opacity-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SidebarSectionLabel({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { collapsed } = useSidebarContext();
  if (collapsed) return null;
  return (
    <div
      className={`px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

Sidebar.Header = SidebarHeader;
Sidebar.Nav = SidebarNav;
Sidebar.Item = SidebarItem;
Sidebar.Footer = SidebarFooter;
Sidebar.Toggle = SidebarToggle;
Sidebar.NewChatButton = SidebarNewChatButton;
Sidebar.SidebarSectionLabel = SidebarSectionLabel;

export { Sidebar };