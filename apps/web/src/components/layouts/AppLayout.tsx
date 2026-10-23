// layouts/AppLayout.tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, NavLink, useNavigate, useLocation, matchPath } from "react-router-dom";
import { ConfirmDialog, Sidebar, NotificationBell, toast } from "@monteai/ui";
import {
  Search,
  MessageCircle,
  MoreVertical,
  Pin,
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
  useSetChatSessionPinned,
  useUpdateChatSession,
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
  const [renamingSession, setRenamingSession] =
    useState<ChatSessionResponseDto | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [openSessionMenu, setOpenSessionMenu] = useState<{
    sessionId: string;
    left: number;
    top: number;
  } | null>(null);
  const deleteSession = useDeleteChatSession(chatService);
  const updateSession = useUpdateChatSession(chatService);
  const setSessionPinned = useSetChatSessionPinned(chatService);

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

  useEffect(() => {
    if (!openSessionMenu) return;

    const closeMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-chat-session-menu]")) return;
      setOpenSessionMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSessionMenu(null);
    };
    const closeOnScroll = () => setOpenSessionMenu(null);

    document.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [openSessionMenu]);

  const handleTogglePinned = async (session: ChatSessionResponseDto) => {
    setOpenSessionMenu(null);
    try {
      const updated = await setSessionPinned.mutateAsync({
        sessionId: session.id,
        pinned: !session.pinned,
      });
      if (!updated) {
        toast.error("Couldn't update the pinned chat.");
        return;
      }
      toast.success(session.pinned ? "Chat unpinned" : "Chat pinned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the pinned chat.");
    }
  };

  const handleRenameSession = async () => {
    if (!renamingSession || updateSession.isPending) return;
    const title = renameTitle.trim();
    if (!title) {
      toast.error("Chat name cannot be empty.");
      return;
    }

    try {
      const updated = await updateSession.mutateAsync({
        sessionId: renamingSession.id,
        title,
      });
      if (!updated) {
        toast.error("Couldn't rename this chat.");
        return;
      }
      toast.success("Chat renamed");
      setRenamingSession(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't rename this chat.");
    }
  };

  const pinnedSessions = chatSessions?.filter((session) => session.pinned) ?? [];
  const recentSessions = chatSessions?.filter((session) => !session.pinned) ?? [];
  const menuSession = chatSessions?.find(
    (session) => session.id === openSessionMenu?.sessionId
  );
  const renderSession = (session: ChatSessionResponseDto) => (
    <div key={session.id} className="group relative">
      <Sidebar.Item
        icon={session.pinned ? <Pin className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        label={session.title}
        active={session.id === activeSessionId}
        className="pr-10"
        onClick={() => { onClose(); navigate(`/chat/${session.id}`); }}
      />
      <button
        type="button"
        title={`Options for ${session.title}`}
        aria-label={`Options for chat: ${session.title}`}
        aria-haspopup="menu"
        aria-expanded={openSessionMenu?.sessionId === session.id}
        data-chat-session-menu
        onClick={(event) => {
          if (openSessionMenu?.sessionId === session.id) {
            setOpenSessionMenu(null);
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          setOpenSessionMenu({
            sessionId: session.id,
            left: Math.max(8, Math.min(rect.right - 192, window.innerWidth - 200)),
            top: Math.min(rect.bottom + 4, window.innerHeight - 150),
          });
        }}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-container-high focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );

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
          <>
            {pinnedSessions.length > 0 && (
              <>
                <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
                  Pinned
                </p>
                {pinnedSessions.map(renderSession)}
              </>
            )}
            {recentSessions.length > 0 && (
              <>
                <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
                  Recents
                </p>
                {recentSessions.map(renderSession)}
              </>
            )}
          </>
        ) : (
          !collapsed && (
            <p className="px-3 py-2 text-xs text-on-surface-variant">
              No conversations yet
            </p>
          )
        )}
      </Sidebar.Nav>

      {openSessionMenu && createPortal(
        <div
          role="menu"
          aria-label="Chat actions"
          data-chat-session-menu
          style={{ position: "fixed", left: openSessionMenu.left, top: openSessionMenu.top }}
          className="z-[70] w-48 rounded-lg border border-outline-variant bg-surface p-1 shadow-xl"
        >
          {menuSession && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleTogglePinned(menuSession)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
                >
                  <Pin className="h-4 w-4" />
                  {menuSession.pinned ? "Unpin chat" : "Pin chat"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenSessionMenu(null);
                    setRenameTitle(menuSession.title);
                    setRenamingSession(menuSession);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenSessionMenu(null);
                    setDeletingSession(menuSession);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
          )}
        </div>,
        document.body
      )}

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

      {createPortal(
        <ConfirmDialog
          open={renamingSession !== null}
          title="Rename chat"
          description="Choose a name for this conversation."
          confirmLabel="Save name"
          loading={updateSession.isPending}
          onConfirm={handleRenameSession}
          onCancel={() => {
            if (!updateSession.isPending) setRenamingSession(null);
          }}
        >
          <input
            autoFocus
            maxLength={100}
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRenameSession();
            }}
            aria-label="Chat name"
            className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
        </ConfirmDialog>,
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
