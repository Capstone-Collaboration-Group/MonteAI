import {
  PRIVACY_NOTICE_VERSION,
  TERMS_AND_CONDITIONS_VERSION,
  type RegistrationDraft,
  type StudentRegistrationDraft,
} from '@monteai/types';
import { toRegistrationDraft, toStudentRegistrationDraft } from '@monteai/utils';

type Consent = Pick<RegistrationDraft, 'privacyNoticeAccepted' | 'privacyNoticeVersion' | 'termsAccepted' | 'termsVersion'>;

/** The ONLY mobile signup fields allowed in AsyncStorage. No password, receipt, capture, or OCR. */
export interface PendingStudentRegistration extends StudentRegistrationDraft, Consent {
  firebaseUid?: string;
}

export interface StudentRegistrationInput extends StudentRegistrationDraft, Consent {
  password: string;
}

export function toPendingStudentRegistration(value: unknown): PendingStudentRegistration | null {
  const details = toStudentRegistrationDraft(value);
  if (!details || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.firebaseUid !== undefined && (typeof source.firebaseUid !== 'string' ||
    !source.firebaseUid.trim() || source.firebaseUid.trim().length > 128)) return null;
  const uid = typeof source.firebaseUid === 'string' ? source.firebaseUid.trim() : '';
  return {
    ...details,
    ...(uid && uid.length <= 128 ? { firebaseUid: uid } : {}),
    privacyNoticeAccepted: source.privacyNoticeAccepted === true,
    privacyNoticeVersion: typeof source.privacyNoticeVersion === 'string' ? source.privacyNoticeVersion.trim() : '',
    termsAccepted: source.termsAccepted === true,
    termsVersion: typeof source.termsVersion === 'string' ? source.termsVersion.trim() : '',
  };
}

export function parsePendingStudentRegistration(raw: string): PendingStudentRegistration | null {
  try { return toPendingStudentRegistration(JSON.parse(raw)); } catch { return null; }
}

export function hasCurrentSignupConsent(draft: PendingStudentRegistration): boolean {
  return draft.privacyNoticeAccepted && draft.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
    draft.termsAccepted && draft.termsVersion === TERMS_AND_CONDITIONS_VERSION;
}

export function matchesSignupAccount(draft: PendingStudentRegistration | null,
  user: { uid: string; email: string | null } | null | undefined): boolean {
  return !!draft && !!user && (!draft.firebaseUid || draft.firebaseUid === user.uid) &&
    draft.email.trim().toLowerCase() === user.email?.trim().toLowerCase();
}

export function toSignupRegistrationDraft(pending: PendingStudentRegistration, uid: string): RegistrationDraft | null {
  return toRegistrationDraft({ ...pending, id: uid, role: 'Student' });
}
