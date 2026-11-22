import type { StudentResponseDto } from "./student";
import type { FacultyResponseDto } from "./faculty";
import type { AdminResponseDto } from "./admin";
import type { ProgramHeadResponseDto } from "./program-head";


export type LoginDto = { 
    email: string;
    password: string;
};

export type AuthTokens = { 
    accessToken: string;
    refreshToken: string;
    expiresAt: string
};

export type AuthUser =
    | (StudentResponseDto & { role: "Student" })
    | (FacultyResponseDto & { role: "Faculty" })
    | (AdminResponseDto & { role: "Admin" })
    | (ProgramHeadResponseDto & { role: "ProgramHead" })

export type LoginResponseDto = { 
    tokens: AuthTokens;
    user: AuthUser;
};

export type RefreshRequestDto = { 
    refreshToken: string;
};


// packages/types/src/auth.ts — additions
export type RegistrationRole = "Student" | "Faculty";

export const PRIVACY_NOTICE_VERSION = "2026-10-23";
export const TERMS_AND_CONDITIONS_VERSION = "2026-10-23";

/** Explicitly persistable profile fields. Never derive drafts with Omit<Request, ...>. */
export interface RegistrationProfileDraft {
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  institute: string;
}

/** Receipt-, capture-, and password-free student details used by mobile signup. */
export interface StudentRegistrationDraft extends RegistrationProfileDraft {
  studentNumber: string;
  position: string;
  program: string;
  yearLevel: number;
  section: string;
}

/** Safe registration draft. Storage must also project these fields at runtime. */
export interface RegistrationDraft extends RegistrationProfileDraft {
  id: string;
  role: RegistrationRole;
  /** Student only */
  studentNumber?: string;
  /** Student only — server column is NOT NULL; send "Member" by default */
  position?: string;
  /** Student only */
  program?: string;
  /** Student only */
  yearLevel?: number;
  /** Student only — single letter */
  section?: string;
  privacyNoticeAccepted: boolean;
  privacyNoticeVersion: string;
  termsAccepted: boolean;
  termsVersion: string;
}

/**
 * In-memory payload for POST /auth/register. Mirrors the server's RegisterUserDto.
 * Student-only fields must be omitted for faculty registrations.
 */
export interface RegisterUserRequest extends RegistrationDraft {
  /** Student only. Keep this short-lived receipt in memory and submit immediately. */
  idVerificationReceipt?: string;
}

/** Profile returned by POST /auth/register (201 initially, 200 for an identical retry). */
export interface RegisterUserResponse {
  id: string;
  email: string;
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  suffix: string | null;
  role: RegistrationRole;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
  studentNumber: string | null;
  institute: string | null;
  program: string | null;
  yearLevel: number | null;
  position: string | null;
  programHandled: string | null;
  totpEnabled: boolean;
}

export interface VerifyOTPDto {
  email: string;
  otp: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  email: string;
  password: string;
}
