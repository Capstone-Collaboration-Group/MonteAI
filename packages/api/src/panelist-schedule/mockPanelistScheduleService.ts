import type { PanelistScheduleService } from "./types";
import type {
  CreatePanelistScheduleDto,
  UpdatePanelistScheduleDto,
  PanelistScheduleResponseDto,
  PanelistResponseDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Raw assignment seed ──────────────────────────────────────────────────────

function buildSeed(): PanelistScheduleResponseDto[] {
  return [
    { scheduleId: "schedule-1", panelistId: "faculty-1",      panelistType: "Faculty",     createdAt: new Date().toISOString() },
    { scheduleId: "schedule-1", panelistId: "programhead-1",  panelistType: "ProgramHead", createdAt: new Date().toISOString() },
    { scheduleId: "schedule-2", panelistId: "programhead-2",  panelistType: "ProgramHead", createdAt: new Date().toISOString() },
    { scheduleId: "schedule-3", panelistId: "faculty-1",      panelistType: "Faculty",     createdAt: new Date().toISOString() },
  ];
}

const assignmentsMap = new Map<string, PanelistScheduleResponseDto>();
buildSeed().forEach((r) => assignmentsMap.set(`${r.scheduleId}-${r.panelistId}`, r));

function buildPool(): PanelistResponseDto[] {
  return [
    {
      id: "faculty-1",
      firstName: "Maria", middleInitial: "S", lastName: "Santos", suffix: undefined,
      email: "maria.santos@cdm.edu.ph",
      role: "Instructor",
      institute: "Institute of Computing",
      panelistType: "Faculty",
      isActive: true,
      assignments: [
        { scheduleId: "schedule-1", groupName: "Group Alpha", date: "2026-11-22", startTime: "08:00", endingTime: "09:00" },
        { scheduleId: "schedule-3", groupName: "Group Gamma", date: "2026-11-22", startTime: "10:00", endingTime: "11:00" },
      ],
      isAssigned: true,
    },
    {
      id: "programhead-1",
      firstName: "Jose", middleInitial: "R", lastName: "Reyes", suffix: undefined,
      email: "jose.reyes@cdm.edu.ph",
      role: "Program Head",
      institute: "Institute of Computing",
      panelistType: "ProgramHead",
      isActive: true,
      assignments: [
        { scheduleId: "schedule-1", groupName: "Group Alpha", date: "2026-11-22", startTime: "08:00", endingTime: "09:00" },
      ],
      isAssigned: true,
    },
    {
      id: "programhead-2",
      firstName: "Ana", middleInitial: "L", lastName: "Lopez", suffix: undefined,
      email: "ana.lopez@cdm.edu.ph",
      role: "Program Head",
      institute: "Institute of Business",
      panelistType: "ProgramHead",
      isActive: true,
      assignments: [
        { scheduleId: "schedule-2", groupName: "Group Beta", date: "2026-11-23", startTime: "13:00", endingTime: "14:00" },
      ],
      isAssigned: true,
    },
    {
      id: "faculty-2",
      firstName: "Carlo", middleInitial: "M", lastName: "Cruz", suffix: undefined,
      email: "carlo.cruz@cdm.edu.ph",
      role: "Instructor",
      institute: "Institute of Engineering",
      panelistType: "Faculty",
      isActive: true,
      assignments: [],   // unassigned — still appears in the pool
      isAssigned: false,
    },
  ];
}

const poolData: PanelistResponseDto[] = buildPool();

// ─── Service ──────────────────────────────────────────────────────────────────

export const mockPanelistScheduleService: PanelistScheduleService = {

  // Returns enriched person data — matches /panelistschedule/details
  async getPanelistSchedules() {
    await delay(300);
    return [...poolData];
  },

  async getPanelistSchedulesById(panelistId: string) {
    await delay(150);
    return Array.from(assignmentsMap.values()).filter((r) => r.panelistId === panelistId);
  },

  async getPanelistScheduleById(scheduleId: string, panelistId: string) {
    await delay(150);
    return assignmentsMap.get(`${scheduleId}-${panelistId}`) ?? null;
  },

  async createPanelistSchedule(dto: CreatePanelistScheduleDto) {
    await delay(300);
    const key = `${dto.scheduleId}-${dto.panelistId}`;
    if (assignmentsMap.has(key)) return false; // duplicate guard

    assignmentsMap.set(key, {
      scheduleId:  dto.scheduleId,
      panelistId:  dto.panelistId,
      panelistType: dto.panelistType,
      createdAt:   new Date().toISOString(),
    });

    // Reflect in pool
    const person = poolData.find((p) => p.id === dto.panelistId);
    if (person) {
      person.assignments.push({
        scheduleId: dto.scheduleId,
        groupName:  "—",   // real data would come from the schedule
        date:       "—",
        startTime:  "—",
        endingTime: "—",
      });
      person.isAssigned = true;
    }

    return true;
  },

  async updatePanelistSchedule(scheduleId: string, panelistId: string, dto: UpdatePanelistScheduleDto) {
    await delay(300);
    const key = `${scheduleId}-${panelistId}`;
    const existing = assignmentsMap.get(key);
    if (!existing) return false;

    assignmentsMap.set(key, { ...existing, panelistType: dto.panelistType });
    return true;
  },

  // Fixed: needs both scheduleId and panelistId (composite key)
  async deletePanelistSchedule(scheduleId: string, panelistId: string) {
    await delay(200);
    const key = `${scheduleId}-${panelistId}`;
    if (!assignmentsMap.has(key)) return false;

    assignmentsMap.delete(key);

    // Reflect in pool
    const person = poolData.find((p) => p.id === panelistId);
    if (person) {
      person.assignments = person.assignments.filter((a) => a.scheduleId !== scheduleId);
      person.isAssigned  = person.assignments.length > 0;
    }

    return true;
  },
};