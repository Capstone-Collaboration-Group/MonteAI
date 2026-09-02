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
export interface RegisterFormDto {
  studentNumber: string;
  fullName: string;
  email: string;
  institute: string;
  program: string;
  year: string;
  password: string;
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
