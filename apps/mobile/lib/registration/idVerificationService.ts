import { createIdVerificationService } from '@monteai/api';
import type { RegistrationDraft, StudentIdVerificationRequest } from '@monteai/types';
import { getFreshFirebaseIdToken } from '../authService';
import { firebaseAuth } from '../firebase';
import { idVerificationEndpoint, registrationUsesMock } from './config';

export function verifyRegistrationId(request: StudentIdVerificationRequest, draft: RegistrationDraft, signal: AbortSignal) {
  // Bind each token refresh (including the single 401 retry) to THIS signup.
  // Never send an old account's capture under a newly signed-in account's token.
  const service = createIdVerificationService({
    endpoint: idVerificationEndpoint,
    useMock: registrationUsesMock,
    getFreshFirebaseIdToken: async () => {
      const token = await getFreshFirebaseIdToken();
      const user = firebaseAuth.currentUser;
      return user?.emailVerified && user.uid === draft.id &&
        user.email?.trim().toLowerCase() === draft.email.trim().toLowerCase() ? token : undefined;
    },
  });
  return service.verifyStudentId(request, { signal });
}
