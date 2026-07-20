import { Navigate, Outlet } from "react-router-dom";
import { useAuth, useUserProfile } from "@monteai/hooks";
import { profileService } from "../../lib/firebaseServices";

export function ProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, error } = useUserProfile(profileService);

  if (authLoading || (user && profileLoading)) return <p>Loading...</p>;
  if (!user) return <Navigate to="/" replace />;
  if (error || !profile) return <Navigate to="/" replace />;

  return <Outlet />;
}