import { useState, useSyncExternalStore } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useMfaPendingChallenge } from "@monteai/hooks";
import type { ProfileService } from "@monteai/api";
import { hasPendingRegistrationFor, subscribePendingRegistration } from "./pendingRegistration";

interface GuestRouteProps {
  profileService: ProfileService;
}

function GuestSessionRoute({ profileService }: GuestRouteProps) {
  const { user } = useAuth();
  const { pending: pendingMfa } = useMfaPendingChallenge();
  // Only check a session that existed when this route was entered. Firebase
  // sign-in inside a guest form must not unmount it before MFA/signup finishes.
  const [entryUserId] = useState(() => user?.uid);
  const pendingRegistration = useSyncExternalStore(
    subscribePendingRegistration,
    () => !!user && hasPendingRegistrationFor(user.uid),
    () => false,
  );
  const checkSession =
    !!user && user.uid === entryUserId && !pendingRegistration && !pendingMfa;

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["userProfile", user?.uid],
    queryFn: () => profileService.getCurrentProfile(),
    enabled: checkSession,
  });

  if (checkSession && isLoading) return <p>Loading...</p>;
  if (checkSession && !isError && profile) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}

/** Keeps completed sessions out of landing/login/signup without blocking drafts. */
export function GuestRoute({ profileService }: GuestRouteProps) {
  const { loading } = useAuth();
  const location = useLocation();

  if (loading) return <p>Loading...</p>;

  // Recheck on every navigation, including between guest routes and Back.
  return <GuestSessionRoute key={location.key} profileService={profileService} />;
}
