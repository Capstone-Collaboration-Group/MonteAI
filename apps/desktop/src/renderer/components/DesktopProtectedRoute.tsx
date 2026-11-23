import { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useMfaPendingChallenge } from '@monteai/hooks';
import { Button, Card } from '@monteai/ui';
import { Navigate, Outlet } from 'react-router-dom';
import { profileService } from '../lib/authServices';
import { useDesktopSession } from './DesktopSessionContext';
import SessionLoading from './SessionLoading';

/** Mounts the sidebar and its queries only after the API accepts the session. */
export default function DesktopProtectedRoute() {
  const { user } = useAuth();
  const { pending } = useMfaPendingChallenge();
  const { signOut } = useDesktopSession();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutDestination, setSignOutDestination] = useState('/');
  const profile = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => profileService.getCurrentProfile(),
    enabled: !!user?.emailVerified && !pending,
    retry: (attempt, error) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      return attempt < 1 && (!status || status >= 500);
    },
  });

  if (!user) return <Navigate to={signOutDestination} replace />;
  if (!user.emailVerified || pending) return <Navigate to="/login" replace />;
  if (profile.isLoading) return <SessionLoading message="Opening your workspace…" />;

  if (profile.isError || !profile.data) {
    const status = axios.isAxiosError(profile.error) ? profile.error.response?.status : undefined;
    const needsLogin = status === 401 || status === 403;

    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-container-low p-6">
        <Card className="w-full max-w-lg p-8">
          <h1 className="text-2xl font-semibold text-on-surface">
            {needsLogin ? 'Please sign in again' : 'Unable to open your workspace'}
          </h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            {needsLogin
              ? 'Your saved session was not accepted. Sign in again to verify your account and complete any two-factor authentication.'
              : 'Your profile could not be loaded. Check your internet connection and that the MonteSkolar API is available, then retry.'}
          </p>
          {signOutError && <p role="alert" className="mt-3 text-sm text-error">{signOutError}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {!needsLogin && (
              <Button type="button" disabled={profile.isFetching} onClick={() => void profile.refetch()}>
                {profile.isFetching ? 'Retrying…' : 'Retry'}
              </Button>
            )}
            <Button
              type="button"
              variant={needsLogin ? 'primary' : 'secondary'}
              disabled={signingOut}
              onClick={async () => {
                // Choose the redirect before Firebase publishes its signed-out
                // state, so the route guard cannot race navigation to /login.
                setSignOutDestination(needsLogin ? '/login' : '/');
                setSigningOut(true);
                setSignOutError(null);
                try {
                  await signOut();
                } catch {
                  setSignOutError('Could not sign out. Please try again.');
                } finally {
                  setSigningOut(false);
                }
              }}
            >
              {signingOut ? 'Signing out…' : needsLogin ? 'Sign in again' : 'Sign out'}
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return <Outlet />;
}
