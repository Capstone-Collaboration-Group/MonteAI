import { Sidebar } from "@monteai/ui/index";
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
import { auth } from "../lib/firebaseServices";
import { queryClient } from "@monteai/hooks";
interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {

  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await auth.signOut();
      queryClient.clear(); // Wipe the TanStack query cache to prevent data leaks
      navigate("/"); // Send them back to the landing page
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };
  return (
    <Sidebar collapsed={collapsed}>
      <Sidebar.Header className="gap-2.5">
        {!collapsed && (
          <>
            <img
              src="/cdm-logo.png"
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
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high ${
            collapsed ? "mx-auto" : "ml-auto"
          }`}
        >
          <Menu className="h-5 w-5" />
        </button>
      </Sidebar.Header>

      <Sidebar.Nav>
        <NavLink to="/" end>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/Announcements">
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
        <NavLink to="/logout">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<LogOut className="h-4 w-4" />}
              label="Logout"
              active={isActive}
              onClick={handleLogout}
            />
          )}
        </NavLink>
      </Sidebar.Footer>
    </Sidebar>
  );
}