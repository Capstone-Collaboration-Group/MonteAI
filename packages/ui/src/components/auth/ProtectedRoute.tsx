// packages/ui/src/components/auth/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth, useUserProfile } from "@monteai/hooks"; // or wherever these hooks live
import type { ProfileService } from "@monteai/api";

interface ProtectedRouteProps {
  profileService: ProfileService;
}

export function ProtectedRoute({ profileService }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, error } = useUserProfile(profileService);

  if (authLoading || (user && profileLoading)) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (error || !profile) return <Navigate to="/login" replace />;

  return <Outlet />;
}