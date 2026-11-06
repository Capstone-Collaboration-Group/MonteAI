import { ArrowRight, CalendarDays, FileText, ShieldCheck } from 'lucide-react';
import { useAuth, useMfaPendingChallenge } from '@monteai/hooks';
import { Button, Card } from '@monteai/ui';
import { Navigate, useNavigate } from 'react-router-dom';

const features = [
  { icon: FileText, title: 'Thesis repository', description: 'Review submissions and manage the institutional research catalog.' },
  { icon: CalendarDays, title: 'Research coordination', description: 'Keep research groups, defense schedules, and announcements organized.' },
  { icon: ShieldCheck, title: 'Secure workspace', description: 'Access tools according to your account role, with optional two-factor authentication.' },
];

export default function Welcome() {
  const { user } = useAuth();
  const { pending } = useMfaPendingChallenge();
  const navigate = useNavigate();

  // Check the real persisted session, not a "has logged in" flag or saved password.
  if (pending) return <Navigate to="/login" replace />;
  if (user) return <Navigate to={user.emailVerified ? '/dashboard' : '/login'} replace />;

  return (
    <main className="flex min-h-screen flex-col bg-surface-container-low/60 p-6 lg:p-10">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <img
          src={`${import.meta.env.BASE_URL}cdm-logo.png`}
          alt="Colegio de Montalban"
          className="h-12 w-12 rounded-full object-cover"
        />
        <div>
          <p className="text-lg font-semibold text-on-surface">MonteSkolar</p>
          <p className="text-xs text-on-surface-variant">Colegio de Montalban · Desktop console</p>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Research and thesis administration</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-on-surface sm:text-5xl">
            Welcome to MonteSkolar
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-on-surface-variant">
            A dedicated workspace for your institution's research. Manage thesis records, coordinate defenses, and keep your research community connected.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={() => navigate('/login')}>
              <span className="flex items-center gap-2">Sign in <ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/register')}>Create an account</Button>
          </div>
          <p className="mt-5 max-w-md text-xs leading-relaxed text-on-surface-variant">
            Your sign-in is remembered on this computer. Always sign out when using a shared device.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="flex gap-4 p-6">
              <div className="h-fit rounded-xl bg-primary/10 p-3 text-primary">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-on-surface">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl border-t border-outline-variant/60 pt-5 text-xs text-on-surface-variant">
        Internet access and a reachable MonteSkolar server are required to sign in and load repository data.
      </footer>
    </main>
  );
}
