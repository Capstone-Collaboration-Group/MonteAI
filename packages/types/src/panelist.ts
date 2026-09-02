
import type { FacultyResponseDto } from "./faculty";
import type { ProgramHeadResponseDto } from "./program-head";
import type { AdminResponseDto } from "./admin";

export type PanelistCandidate =
  | (FacultyResponseDto     & { panelistType: "faculty" })
  | (ProgramHeadResponseDto & { panelistType: "program-head" })
  | (AdminResponseDto       & { panelistType: "admin" });

export function getPanelistDisplayName(p: PanelistCandidate): string {
  const mid = p.middleInitial ? ` ${p.middleInitial}.` : "";
  const suf = p.suffix ? ` ${p.suffix}` : "";
  return `${p.firstName}${mid} ${p.lastName}${suf}`;
}

export function getPanelistInitials(p: PanelistCandidate): string {
  return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
}