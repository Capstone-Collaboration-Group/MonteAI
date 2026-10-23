// packages/ui/src/components/NotificationBell.tsx
//
// Shared in-app notification bell + dropdown for web and desktop. Mobile
// renders its own screen (apps/mobile/app/notifications.tsx) instead.
//
// Router-agnostic on purpose: the host passes `onNavigate(targetType,
// targetId)` and maps it to its own router (react-router on web, HashRouter
// on desktop), so this component never imports navigation.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationService } from "@monteai/api";
import type { NotificationResponseDto } from "@monteai/types";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@monteai/hooks";

export type NotificationTargetNavigator = (
  targetType: string,
  targetId?: string | null
) => void;

interface NotificationBellProps {
  notificationService: NotificationService;
  /** App-supplied deep-link handler; receives targetType + targetId. */
  onNavigate: NotificationTargetNavigator;
  /** Poll cadence in ms; 0 disables polling. Default 30s. */
  pollIntervalMs?: number;
  className?: string;
}

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: NotificationResponseDto;
  onClick: (notification: NotificationResponseDto) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(notification)}
        className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
          notification.isRead ? "bg-white" : "bg-blue-50/50"
        }`}
      >
        <div className="flex items-start gap-2">
          {!notification.isRead && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`truncate text-sm ${
                  notification.isRead ? "text-gray-700" : "font-semibold text-gray-900"
                }`}
              >
                {notification.title}
              </span>
              <span className="shrink-0 text-[11px] text-gray-400">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
              {notification.body}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}

export function NotificationBell({
  notificationService,
  onNavigate,
  pollIntervalMs = 30_000,
  className = "",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  // Viewport coordinates for the portalled panel — computed from the bell's
  // rect so a 320px dropdown anchored inside a 64px collapsed sidebar can
  // never be clipped off-screen.
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount } = useNotifications(notificationService, {
    pageSize: 15,
    refetchIntervalMs: pollIntervalMs,
  });
  const markRead = useMarkNotificationRead(notificationService);
  const markAllRead = useMarkAllNotificationsRead(notificationService);

  const placePanel = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(320, window.innerWidth - 16);
    const estimatedHeight = Math.min(420, window.innerHeight - 16);

    // Prefer aligning the panel's right edge with the bell's; flip it to the
    // right of the bell when the viewport's left edge would clip it.
    let left = rect.right - width;
    if (left < 8) left = Math.min(rect.right + 8, window.innerWidth - width - 8);

    // Keep the panel fully on-screen vertically — flip above the bell when
    // there isn't enough room below.
    let top = rect.bottom + 4;
    if (top + estimatedHeight > window.innerHeight - 8)
      top = Math.max(8, rect.top - estimatedHeight - 4);

    setPanelPos({ top, left });
  }, []);

  // Close on outside click / Escape so the panel behaves like a real dropdown.
  // Both refs are checked: the panel is portalled to document.body, so it is
  // no longer a DOM descendant of the bell container.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keep the panel glued to the bell while open across layout changes.
  useEffect(() => {
    if (!open) return;
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open, placePanel]);

  const handleToggle = () => {
    if (!open) placePanel();
    setOpen((value) => !value);
  };

  const handleItemClick = (notification: NotificationResponseDto) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    onNavigate(notification.targetType, notification.targetId);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={handleToggle}
        className="relative p-2 rounded-full transition-colors hover:bg-gray-100"
      >
        <Bell size={22} color="black" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: panelPos.top, left: panelPos.left }}
            className="fixed z-50 w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <CheckCheck size={14} />
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleItemClick}
                  />
                ))}
              </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
