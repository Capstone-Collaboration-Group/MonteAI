import { useState } from "react";
import { Sidebar, NotificationBell, toast } from "@monteai/ui/index";
import {
  NavLink,
  useNavigate
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  LogOut,
  Settings as SettingsIcon,
  HardDriveDownload,
  Info,
  Megaphone,
  Menu,
} from "lucide-react";
import { notificationService } from "../lib/notificationService";
import { useDesktopSession } from "./DesktopSessionContext";

// Deep links for notification clicks (HashRouter routes).
function notificationRoute(targetType: string): string | null {
  switch (targetType) {
    case "research_group":
      return "/research-groups";
    case "schedule":
      return "/schedule";
    case "announcement":
      return "/announcements";
    default:
      return null;
  }
}

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {

  const navigate = useNavigate();
  const { signOut } = useDesktopSession();
  const [signingOut, setSigningOut] = useState(false);
  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to sign out", error);
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <Sidebar collapsed={collapsed} className="shrink-0" aria-label="Main navigation">
      <Sidebar.Header className="gap-2.5">
        {!collapsed && (
          <>
            <img
              src={`${import.meta.env.BASE_URL}cdm-logo.png`}
              alt="Colegio de Montalban"
              className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-tight">MonteSkolar</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">
            Admin console
          </p>
            </div>
          </>
        )}
        {/* Collapsed: toggle on top, bell under it (above the New chat + icon
            in the body). Expanded: both sit in a row on the right. */}
        <div
          className={`flex items-center ${
            collapsed ? "mx-auto flex-col gap-1" : "ml-auto gap-1.5"
          }`}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
          >
            <Menu className="h-5 w-5" />
          </button>
          <NotificationBell
            notificationService={notificationService}
            onNavigate={(targetType) => {
              const route = notificationRoute(targetType);
              if (route) navigate(route);
            }}
            className="shrink-0"
          />
        </div>
      </Sidebar.Header>

      <Sidebar.Nav>
        <NavLink to="/dashboard" end>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/announcements">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Megaphone className="h-4 w-4" />}
              label="Announcements"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/theses">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<FileText className="h-4 w-4" />}
              label="Theses"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/panelist">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Users className="h-4 w-4" />}
              label="Panelist"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/faculty">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Users className="h-4 w-4" />}
              label="Faculty"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/research-groups">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Users className="h-4 w-4" />}
              label="Research Groups"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/schedule">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Calendar className="h-4 w-4" />}
              label="Schedule"
              active={isActive}
            />
          )}
        </NavLink>

      </Sidebar.Nav>

      <Sidebar.Footer className="mt-auto space-y-1">
        <NavLink to="/backup">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<HardDriveDownload className="h-4 w-4" />}
              label="Backup"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<SettingsIcon className="h-4 w-4 " />}
              label="Settings"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/about">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Info className="h-4 w-4" />}
              label="About"
              active={isActive}
            />
          )}
        </NavLink>
        <Sidebar.Item
          icon={<LogOut className="h-4 w-4" />}
          label={signingOut ? "Signing out…" : "Logout"}
          disabled={signingOut}
          onClick={() => void handleLogout()}
        />
      </Sidebar.Footer>
    </Sidebar>
  );
}
