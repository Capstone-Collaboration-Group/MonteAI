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

/**
 * Payload for POST /auth/register. Mirrors the server's `RegisterUserDto`
 * (ASP.NET binds JSON case-insensitively). Student-only fields must be
 * omitted for faculty registrations and vice versa.
 */
export interface RegisterUserRequest {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  role: RegistrationRole;
  /** Student only */
  studentNumber?: string;
  /** Student only — server column is NOT NULL; send "Member" by default */
  position?: string;
  institute: string;
  /** Student only */
  program?: string;
  /** Student only */
  yearLevel?: number;
  /** Student only — single letter */
  section?: string;
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
