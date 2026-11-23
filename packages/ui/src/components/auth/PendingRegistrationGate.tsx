import { useSyncExternalStore, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@monteai/hooks";
import { hasPendingRegistrationFor, subscribePendingRegistration } from "./pendingRegistration";

/** Mount BEFORE the profile/protected route, so even a cached profile cannot
 * promote an unfinished signup. Opt-in on web; desktop integration is deferred. */
export function PendingRegistrationGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pending = useSyncExternalStore(subscribePendingRegistration,
    () => !!user && hasPendingRegistrationFor(user.uid), () => false);
  if (loading) return <p>Loading...</p>;
  if (pending) return <Navigate to="/register" replace />;
  return children;
}
