
import type { ResearchGroupResponseDto } from "./research-group";

export interface RegisterUserDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix?: string;
  role: string;

  // Student-specific
  studentNumber?: string;
  groupId?: string;
  position?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  section?: string;

  // Program Head-specific
  programHandled?: string;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  role?: string;
  isActive?: boolean;

  // Profile fields (role-specific; null/omitted = leave unchanged)
  studentNumber?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  position?: string;
  programHandled?: string;
}

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix?: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Profile payload returned by `GET /api/v1/User/me`.
 * Role-specific fields are present depending on the caller's role
 * (students additionally get `section`/`researchGroup`, faculty/program
 * heads get `institute`, admins get `position`, ...).
 */
export interface UserProfileDto {
  id: string;
  email: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;

  studentNumber?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  section?: string;
  position?: string;
  programHandled?: string;
  researchGroup?: ResearchGroupResponseDto;
}

/**
 * Payload for `PUT /api/v1/User/me`. Email and role are intentionally
 * excluded: email is read-only (kept in sync with Firebase) and role is
 * derived server-side from the authenticated user's profile.
 * Omit optional fields you don't want to change; empty strings should be
 * omitted rather than sent (server maps onto non-nullable char columns).
 */
export interface UpdateProfileRequest {
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  suffix?: string;
  studentNumber?: string;
  institute?: string;
  program?: string;
  yearLevel?: number;
  position?: string;
  programHandled?: string;
}