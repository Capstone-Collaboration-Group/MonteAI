import { RegistrationError } from '@monteai/api';
import type { RegisterUserRequest } from '@monteai/types';
import { toRegistrationDraft } from '@monteai/utils';
import type { createPendingSignupSession, SignupAccount } from './pendingSignupSession';

/** Runtime allowlist at the provider/transport boundary; never send a caller's DTO. */
export async function submitPendingSignupRegistration(
  signup: ReturnType<typeof createPendingSignupSession>,
  getAccount: () => SignupAccount | null,
  request: RegisterUserRequest,
  signal: AbortSignal,
  send: (profile: RegisterUserRequest, signal: AbortSignal) => Promise<unknown>,
) {
  const ticket = signup.ticket(getAccount());
  const clean = toRegistrationDraft(request);
  if (!clean || JSON.stringify(clean) !== JSON.stringify(ticket.draft) ||
    Object.entries(ticket.draft).some(([key, field]) => request[key as keyof RegisterUserRequest] !== field)) {
    throw new RegistrationError('identity_mismatch');
  }
  if (typeof request.idVerificationReceipt !== 'string' || !request.idVerificationReceipt || request.idVerificationReceipt.length > 4096) {
    throw new RegistrationError('invalid_receipt');
  }
  const profile: RegisterUserRequest = { ...clean, idVerificationReceipt: request.idVerificationReceipt };
  const discard = () => { profile.idVerificationReceipt = undefined; };
  signal.addEventListener('abort', discard, { once: true });
  try {
    signup.assertCurrent(ticket, getAccount(), signal);
    await send(profile, signal);
    signup.assertCurrent(ticket, getAccount(), signal);
    return ticket; // receipt-free; caller performs its final guard/session promotion synchronously
  } finally {
    signal.removeEventListener('abort', discard);
    discard();
  }
}
