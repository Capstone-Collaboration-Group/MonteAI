import type { PanelistScheduleResponseDto, PanelistType } from "./panelist-schedule";
import type { ResearchGroupResponseDto } from "./research-group";

/**
 * A panelist's role on the defense panel — printed in the proceedings'
 * Section II (Designation / Role). Chairperson and Adviser are one-per-panel.
 */
export type PanelRole = "Panel Chairperson" | "Panel Member" | "Capstone Adviser";

export const PANEL_ROLES: ReadonlyArray<PanelRole> = [
  "Panel Chairperson",
  "Panel Member",
  "Capstone Adviser",
];

/**
 * Moves `role` onto the panelist with `id`. Panel Chairperson and Capstone
 * Adviser are exclusive: taking one clears it from anyone else, who falls
 * back to Panel Member — so a panel can never end up with two chairs.
 */
export function assignPanelRole<T extends { id: string; panelRole: PanelRole }>(
  rows: readonly T[],
  id: string,
  role: PanelRole
): T[] {
  const exclusive = role === "Panel Chairperson" || role === "Capstone Adviser";
  return rows.map((row) => {
    if (row.id === id) return { ...row, panelRole: role };
    if (exclusive && row.panelRole === role)
      return { ...row, panelRole: "Panel Member" };
    return row;
  });
}

/** First panelist defaults to Panel Chairperson, everyone after to Panel Member. */
export function defaultPanelRole(rows: readonly { panelRole: PanelRole }[]): PanelRole {
  return rows.some((row) => row.panelRole === "Panel Chairperson")
    ? "Panel Member"
    : "Panel Chairperson";
}

export interface CreatePanelistEntryDto {
  panelistId: string;
  panelistType: PanelistType;
  /** Defense-panel role recorded for the proceedings; omitted on legacy rows. */
  role?: PanelRole;
}

export interface CreateScheduleDto {
  scheduledBy?: string;
  groupId?: string;
  date: string;
  startTime: string;
  endingTime: string;
  roomVenue: string;
  additionalInformation?: string;
  panelists: CreatePanelistEntryDto[];
}

export interface UpdateScheduleDto {
  groupId?: string;
  date?: string;
  startTime?: string;
  endingTime?: string;
  roomVenue?: string;
  additionalInformation?: string;
  panelists?: PanelistScheduleResponseDto[];
}

export interface UpdateScheduleTimesDto {
  date: string;
  startTime: string;
  endingTime: string;
}

export interface ScheduleResponseDto {
  scheduleId: string;
  scheduledBy: string;
  researchGroup?: ResearchGroupResponseDto;
  date: string;
  startTime: string;
  endingTime: string;
  roomVenue: string;
  additionalInformation?: string;
  panelists: PanelistScheduleResponseDto[];
}
