import { RegistrationError, requireStudentSignupDraft } from '@monteai/api';
import type { RegistrationDraft } from '@monteai/types';
import { matchesSignupAccount, toPendingStudentRegistration, toSignupRegistrationDraft,
  type PendingStudentRegistration } from './pendingRegistration';

export interface SignupAccount {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

interface SignupTicket { revision: number; draft: RegistrationDraft }

/** Per-provider session gate. It holds persistable profile primitives ONLY. */
export function createPendingSignupSession() {
  let pending: PendingStudentRegistration | null = null;
  let revision = 0;
  let accountKey: string | null | undefined;
  const changes = new Set<(draft: PendingStudentRegistration | null) => void>();
  const invalidations = new Set<() => void>();

  const getPending = () => pending ? { ...pending } : null;
  function publish(invalidate: boolean): void {
    if (invalidate) invalidations.forEach(listener => {
      try { listener(); } catch { /* session changes still take effect */ }
    });
    changes.forEach(listener => {
      try { listener(getPending()); } catch { /* callbacks never own the draft */ }
    });
  }

  function verifiedDraft(user: SignupAccount | null): RegistrationDraft {
    if (!user || !matchesSignupAccount(pending, user)) throw new RegistrationError('authentication_required');
    if (!user.emailVerified) throw new RegistrationError('email_unverified');
    const draft = toSignupRegistrationDraft(pending!, user.uid);
    if (!draft) throw new RegistrationError('invalid_request');
    return requireStudentSignupDraft(draft);
  }

  function assertCurrent(ticket: SignupTicket, user: SignupAccount | null, signal?: AbortSignal): void {
    if (signal?.aborted) throw new RegistrationError('cancelled');
    if (ticket.revision !== revision || JSON.stringify(ticket.draft) !== JSON.stringify(verifiedDraft(user))) {
      throw new RegistrationError('identity_mismatch');
    }
  }

  return {
    getPending,
    get revision(): number { return revision; },
    replace(value: unknown): PendingStudentRegistration {
      const next = toPendingStudentRegistration(value);
      if (!next) throw new RegistrationError('invalid_request');
      pending = next;
      revision++;
      publish(true);
      return { ...next };
    },
    clear(): void {
      pending = null;
      revision++;
      publish(true);
    },
    invalidate(): void {
      revision++;
      publish(true); // keep the safe draft/session gate during a failed login
    },
    observeAccount(user: SignupAccount | null): boolean {
      const nextKey = user ? JSON.stringify([user.uid, user.email?.trim().toLowerCase() ?? '']) : null;
      const switched = accountKey !== undefined && accountKey !== nextKey;
      const unrelated = !!user && !!pending && !matchesSignupAccount(pending, user);
      accountKey = nextKey;
      if (unrelated) pending = null;
      if (switched || unrelated) {
        revision++;
        publish(true);
      }
      return switched || unrelated;
    },
    gatesSession(user: SignupAccount | null): boolean {
      return matchesSignupAccount(pending, user);
    },
    ticket(user: SignupAccount | null): SignupTicket {
      return { revision, draft: Object.freeze(verifiedDraft(user)) };
    },
    assertCurrent,
    complete(ticket: SignupTicket, user: SignupAccount | null, signal?: AbortSignal): PendingStudentRegistration {
      assertCurrent(ticket, user, signal);
      const completed = { ...pending! };
      pending = null;
      revision++;
      // A successful registration opens the session; do NOT cancel its flow
      // while that flow is clearing its receipt and reporting completion.
      publish(false);
      return completed;
    },
    subscribe(listener: (draft: PendingStudentRegistration | null) => void): () => void {
      changes.add(listener);
      listener(getPending());
      return () => { changes.delete(listener); };
    },
    onInvalidate(listener: () => void): () => void {
      invalidations.add(listener);
      return () => { invalidations.delete(listener); };
    },
  };
}
