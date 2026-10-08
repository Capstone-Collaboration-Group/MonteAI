// layouts/AppLayout.tsx
import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation, matchPath } from "react-router-dom";
import { Sidebar } from "@monteai/ui";
import {
  MessageSquare,
  Search,
  MessageCircle,
  Plus,
  LogOut,
  Settings,
  Users,
  Menu,
  X,
} from "lucide-react"; // Imported LogOut
import CdmLogo from "../../assets/cdm-logo.png";

// Import your global hooks and initialized services
import { useUserProfile, useAuth, useChatSessions, queryClient } from "@monteai/hooks";
import { profileService } from "../../lib/authService";
import { chatService } from "../../lib/chat/chatService";
import { auth } from "../../lib/firebase";

function AppSidebar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Fetch the dynamic user profile
  const { profile, isLoading } = useUserProfile(profileService);
  const { user } = useAuth();

  // 2. Fetch the signed-in user's chat sessions (sorted latest-first)
  const {
    data: chatSessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useChatSessions(chatService, user?.uid);

  // Extract /chat/:sessionId so the open conversation can be highlighted
  const activeSessionId =
    matchPath("/chat/:sessionId", location.pathname)?.params.sessionId ?? null;

  // 3. Handle secure sign out
  const handleLogout = async () => {
    try {
      await auth.signOut();
      queryClient.clear(); // Wipe the TanStack query cache to prevent data leaks
      onClose();
      navigate("/"); // Send them back to the landing page
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <Sidebar aria-label="Main navigation" className="shrink-0">
      <Sidebar.Header className="gap-2.5">
        <img
          src={CdmLogo}
          alt="Colegio de Montalban"
          className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-md font-bold leading-tight text-on-surface">
            MonteAI
          </p>
          <p className="text-[11px] leading-tight text-on-surface-variant">
            Your AI research assistant
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high md:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </Sidebar.Header>

      <div className="px-2 pb-2">
        <Sidebar.NewChatButton onClick={() => { onClose(); navigate("/home"); }}>
          <Plus className="h-4 w-4" /> New chat
        </Sidebar.NewChatButton>
      </div>

      <Sidebar.Nav className="gap-0.5">
        <NavLink to="/chat" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<MessageSquare className="h-4 w-4" />}
              label="AI Chat"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/theses" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Search className="h-4 w-4" />}
              label="Find thesis"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/submit" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Search className="h-4 w-4" />}
              label="Submit Thesis"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/settings" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={isActive}
            />
          )}
        </NavLink>
        <NavLink to="/announcements" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item icon={<Search className="h-4 w-4" />} label="Announcements" active={isActive} />
          )}
        </NavLink>
        <NavLink to="/research-groups" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<Users className="h-4 w-4" />}
              label="Research Groups"
              active={isActive}
            />
          )}
        </NavLink>
      </Sidebar.Nav>

      <Sidebar.SidebarSectionLabel>Recents</Sidebar.SidebarSectionLabel>
      <Sidebar.Nav className="gap-0.5">
        {sessionsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-container-high" />
              <div className="h-4 w-full animate-pulse rounded bg-surface-container-high" />
            </div>
          ))
        ) : sessionsError ? (
          <p className="px-3 py-2 text-xs text-on-surface-variant">
            Couldn't load conversations.
          </p>
        ) : chatSessions && chatSessions.length > 0 ? (
          chatSessions.map((session) => (
            <Sidebar.Item
              key={session.id}
              icon={<MessageCircle className="h-4 w-4" />}
              label={session.title}
              active={session.id === activeSessionId}
              onClick={() => { onClose(); navigate(`/chat/${session.id}`); }}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-on-surface-variant">
            No conversations yet
          </p>
        )}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-surface">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}
      <div
        id="app-navigation"
        className={`fixed inset-y-0 left-0 z-50 h-dvh transition-transform duration-200 ${
          sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        } md:visible md:static md:z-auto md:h-full md:translate-x-0`}
      >
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-outline-variant/70 bg-surface px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="app-navigation"
            className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface hover:bg-surface-container-high"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src={CdmLogo}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="font-semibold text-on-surface">MonteAI</span>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
