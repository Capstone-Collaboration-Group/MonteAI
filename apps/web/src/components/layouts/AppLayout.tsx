// layouts/AppLayout.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, NavLink, useNavigate, useLocation, matchPath } from "react-router-dom";
import { ConfirmDialog, Sidebar, NotificationBell, toast } from "@monteai/ui";
import {
  Search,
  MessageCircle,
  Trash2,
  Plus,
  LogOut,
  Settings,
  Users,
  Menu,
  X,
  Book,
  Megaphone,
  CalendarDays,
} from "lucide-react"; // Imported LogOut
import CdmLogo from "../../assets/cdm-logo.png";

// Import your global hooks and initialized services
import {
  useUserProfile,
  useAuth,
  useChatSessions,
  useDeleteChatSession,
  queryClient,
} from "@monteai/hooks";
import type { ChatSessionResponseDto } from "@monteai/types";
import { profileService } from "../../lib/authService";
import { chatService } from "../../lib/chat/chatService";
import { notificationService } from "../../lib/notificationService";
import { auth } from "../../lib/firebase";

// Deep links for notification clicks — each app maps targetType to its router.
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

function AppSidebar({
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
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
  const [deletingSession, setDeletingSession] =
    useState<ChatSessionResponseDto | null>(null);
  const deleteSession = useDeleteChatSession(chatService);

  // Extract /chat/:sessionId so the open conversation can be highlighted
  const activeSessionId =
    matchPath("/chat/:sessionId", location.pathname)?.params.sessionId ?? null;

  const confirmDeleteSession = async () => {
    if (!deletingSession || deleteSession.isPending) return;

    try {
      await deleteSession.mutateAsync(deletingSession.id);
      toast.success("Chat deleted");
      if (activeSessionId === deletingSession.id) {
        navigate("/home");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this chat.");
    } finally {
      setDeletingSession(null);
    }
  };

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
    <Sidebar collapsed={collapsed} aria-label="Main navigation" className="shrink-0">
      <Sidebar.Header className="gap-2.5">
        {!collapsed && (
          <>
            <img
              src={CdmLogo}
              alt="Colegio de Montalban"
              className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-md font-bold leading-tight text-on-surface">
                MonteSkolar
              </p>
            </div>
          </>
        )}
        {/* Collapsed: toggle on top, bell under it (above the New chat + icon
            in the body). Expanded: close (mobile), toggle, and bell sit in a
            row on the right — X and Menu never coexist (md:hidden vs md:flex). */}
        <div
          className={`flex items-center ${
            collapsed ? "mx-auto flex-col gap-1" : "ml-auto gap-1.5"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high md:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high md:flex"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
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

      <div className="px-2 pb-2">
        <Sidebar.NewChatButton
          onClick={() => { onClose(); navigate("/home"); }}
          title={collapsed ? "New chat" : undefined}
          aria-label={collapsed ? "New chat" : undefined}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "New chat"}
        </Sidebar.NewChatButton>
      </div>

      <Sidebar.Nav className="gap-0.5">
       
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
              icon={<Book className="h-4 w-4" />}
              label="Submit Thesis"
              active={isActive}
            />
          )}
        </NavLink>
        
        <NavLink to="/announcements" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item icon={<Megaphone className="h-4 w-4" />} label="Announcements" active={isActive} />
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
        <NavLink to="/schedule" onClick={onClose}>
          {({ isActive }) => (
            <Sidebar.Item
              icon={<CalendarDays className="h-4 w-4" />}
              label="Schedules"
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
      </Sidebar.Nav>

      <Sidebar.SidebarSectionLabel>Recents</Sidebar.SidebarSectionLabel>
      <Sidebar.Nav className="gap-0.5">
        {sessionsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-container-high" />
              {!collapsed && <div className="h-4 w-full animate-pulse rounded bg-surface-container-high" />}
            </div>
          ))
        ) : sessionsError ? (
          !collapsed && (
            <p className="px-3 py-2 text-xs text-on-surface-variant">
              Couldn't load conversations.
            </p>
          )
        ) : chatSessions && chatSessions.length > 0 ? (
          chatSessions.map((session) => (
            <div key={session.id} className="group relative">
              <Sidebar.Item
                icon={<MessageCircle className="h-4 w-4" />}
                label={session.title}
                active={session.id === activeSessionId}
                className="pr-10"
                onClick={() => { onClose(); navigate(`/chat/${session.id}`); }}
              />
              <button
                type="button"
                title={`Delete ${session.title}`}
                aria-label={`Delete chat: ${session.title}`}
                onClick={() => setDeletingSession(session)}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant opacity-0 transition-opacity hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          !collapsed && (
            <p className="px-3 py-2 text-xs text-on-surface-variant">
              No conversations yet
            </p>
          )
        )}
      </Sidebar.Nav>

      {createPortal(
        <ConfirmDialog
          open={deletingSession !== null}
          title="Delete this chat?"
          description={`This permanently deletes "${deletingSession?.title ?? ""}" and its messages. This action cannot be undone.`}
          confirmLabel="Delete chat"
          loading={deleteSession.isPending}
          onConfirm={confirmDeleteSession}
          onCancel={() => {
            if (!deleteSession.isPending) setDeletingSession(null);
          }}
        />,
        document.body
      )}

      {/* 3. Make the Footer dynamic and add the logout trigger */}
      <Sidebar.Footer className={`flex items-center gap-2.5 px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          {!collapsed && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-semibold uppercase text-on-primary-container">
            {/* Extract the first letter of the email dynamically */}
            {isLoading ? "..." : profile?.email?.[0] || "U"}
          </div>}
          {!collapsed && (
            <span className="truncate text-xs text-on-surface-variant">
              {isLoading ? "Loading..." : profile?.email}
            </span>
          )}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

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
        <AppSidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarOpen ? false : sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
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
          <NotificationBell
            notificationService={notificationService}
            onNavigate={(targetType) => {
              const route = notificationRoute(targetType);
              if (route) navigate(route);
            }}
            className="ml-auto"
          />
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
