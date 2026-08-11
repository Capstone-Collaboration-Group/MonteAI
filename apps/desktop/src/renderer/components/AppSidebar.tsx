import { Sidebar } from "@monteai/ui/index";
import {
  NavLink
} from "react-router-dom";
import { LayoutDashboard,
    Users,
    Info,
    FileText,
    Calendar,
    LogOut,
    Settings as SettingsIcon,
     Megaphone} from "lucide-react";
export default function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header className="gap-2.5">
        <img
          src="/cdm-logo.png"
          alt="Colegio de Montalban"
          className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
        />
        <div>
          <p className="text-[15px] font-medium leading-tight">MonteSkolar</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">
            Admin console
          </p>
        </div>
      </Sidebar.Header>

      <Sidebar.Nav>
        <NavLink to="/">
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

      <Sidebar.Footer>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<SettingsIcon className="h-4 w-4 " />}
              label="Settings"
              active={isActive}
            />
          )}
        </NavLink>
      </Sidebar.Footer>
      <Sidebar.Footer className="border-none">
        <NavLink to="/logout">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Info className="h-4 w-4" />}
              label="About"
              active={isActive}
            />
          )}
        </NavLink>
      </Sidebar.Footer>
      <Sidebar.Footer className="border-none">
        <NavLink to="/logout">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<LogOut className="h-4 w-4" />}
              label="Logout"
              active={isActive}
            />
          )}
        </NavLink>
      </Sidebar.Footer>
    </Sidebar>
  );
}