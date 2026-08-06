// packages/api/src/panelist-schedule/mockPanelistScheduleService.ts

import type { PanelistScheduleService } from "./types";
import type {
  CreatePanelistScheduleDto,
  UpdatePanelistScheduleDto,
  PanelistScheduleResponseDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockPanelistScheduleService loaded — Initialized with seed data");

function buildSeed(): PanelistScheduleResponseDto[] {
  return [
    {
      scheduleId: "schedule-1",
      panelistId: "faculty-1",
      panelistType: "Adviser",
    },
    {
      scheduleId: "schedule-1",
      panelistId: "faculty-2",
      panelistType: "Panelist",
    },
    {
      scheduleId: "schedule-2",
      panelistId: "faculty-3",
      panelistType: "Panelist",
    },
    {
      scheduleId: "schedule-3",
      panelistId: "faculty-1",
      panelistType: "Chair",
    },
  ];
}

const panelistSchedulesMap = new Map<string, PanelistScheduleResponseDto>();

buildSeed().forEach((record) => {
  const key = `${record.scheduleId}-${record.panelistId}`;
  panelistSchedulesMap.set(key, record);
});

export const mockPanelistScheduleService: PanelistScheduleService = {
  async getPanelistSchedules() {
    await delay(300);
    return Array.from(panelistSchedulesMap.values());
  },

  async getPanelistSchedulesById(panelistId: string) {
    await delay(150);

    return Array.from(panelistSchedulesMap.values()).filter(
      (record) => record.panelistId === panelistId
    );
  },

  async getPanelistScheduleById(
    scheduleId: string,
    panelistId: string
  ) {
    await delay(150);

    const key = `${scheduleId}-${panelistId}`;

    return panelistSchedulesMap.get(key) ?? null;
  },

  async createPanelistSchedule(dto: CreatePanelistScheduleDto) {
    await delay(300);

    const key = `${dto.scheduleId}-${dto.panelistId}`;

    panelistSchedulesMap.set(key, {
      scheduleId: dto.scheduleId,
      panelistId: dto.panelistId,
      panelistType: dto.panelistType,
    });

    return true;
  },

  async updatePanelistSchedule(
    scheduleId: string,
    panelistId: string,
    dto: UpdatePanelistScheduleDto
  ) {
    await delay(300);

    const key = `${scheduleId}-${panelistId}`;

    const existing = panelistSchedulesMap.get(key);

    if (!existing) {
      return false;
    }

    panelistSchedulesMap.set(key, {
      ...existing,
      panelistType: dto.panelistType,
    });

    return true;
  },

  async deletePanelistSchedule(scheduleId: string) {
    await delay(200);

    let deleted = false;

    for (const [key, value] of panelistSchedulesMap.entries()) {
      if (value.scheduleId === scheduleId) {
        panelistSchedulesMap.delete(key);
        deleted = true;
      }
    }

    return deleted;
  },
};