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

