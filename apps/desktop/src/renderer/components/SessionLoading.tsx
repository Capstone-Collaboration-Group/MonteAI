import { LoaderCircle } from 'lucide-react';

export default function SessionLoading({ message = 'Restoring your session…' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low">
      <div role="status" className="flex items-center gap-3 text-sm text-on-surface-variant">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
        {message}
      </div>
    </div>
  );
}
