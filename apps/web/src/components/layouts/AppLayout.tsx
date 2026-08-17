// layouts/AppLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Sidebar } from "@monteai/ui";
import {
  MessageSquare,
  Search,
  MessageCircle,
  Plus,
  LogOut,
  Settings,
} from "lucide-react"; // Imported LogOut
import { recentChats } from "../../lib/mock-data";
import CdmLogo from "../../assets/cdm-logo.png";

// Import your global hooks and initialized services
import { useUserProfile, queryClient } from "@monteai/hooks";
import { profileService } from "../../lib/firebaseServices";
import { auth } from "../../lib/firebase";

function AppSidebar() {
  const navigate = useNavigate();

  // 1. Fetch the dynamic user profile
  const { profile, isLoading } = useUserProfile(profileService);

  // 2. Handle secure sign out
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
    <Sidebar>
      <Sidebar.Header className="gap-2.5">
        <img
          src={CdmLogo}
          alt="Colegio de Montalban"
          className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
        />
        <div>
          <p className="text-md font-bold leading-tight text-on-surface">
            MonteAI
          </p>
          <p className="text-[11px] leading-tight text-on-surface-variant">
            Your AI research assistant
          </p>
        </div>
      </Sidebar.Header>

      <div className="px-2 pb-2">
        <Sidebar.NewChatButton onClick={() => navigate("/home")}>
          <Plus className="h-4 w-4" /> New chat
        </Sidebar.NewChatButton>
      </div>

      <Sidebar.Nav className="gap-0.5">
        <NavLink to="/chat">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<MessageSquare className="h-4 w-4" />}
              label="AI Chat"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/thesis">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Search className="h-4 w-4" />}
              label="Find thesis"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/submit">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Search className="h-4 w-4" />}
              label="Submit Thesis"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/announcements">
          {({ isActive }) => (
            <Sidebar.Item icon={<Search className="h-4 w-4" />} label="Announcements" active={isActive} />
          )}
        </NavLink>
      </Sidebar.Nav>

      <Sidebar.SidebarSectionLabel>Recents</Sidebar.SidebarSectionLabel>
      <Sidebar.Nav className="gap-0.5">
        {recentChats.map((chat) => (
          <Sidebar.Item
            key={chat.id}
            icon={<MessageCircle className="h-4 w-4" />}
            label={chat.title}
          />
        ))}
      </Sidebar.Nav>

      {/* 3. Make the Footer dynamic and add the logout trigger */}
      <Sidebar.Footer className="flex items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-semibold uppercase text-on-primary-container">
            {/* Extract the first letter of the email dynamically */}
            {isLoading ? "..." : profile?.email?.[0] || "U"}
          </div>
          <span className="truncate text-xs text-on-surface-variant">
            {isLoading ? "Loading..." : profile?.email}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-md p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </Sidebar.Footer>
    </Sidebar>
  );
}

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-surface">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
