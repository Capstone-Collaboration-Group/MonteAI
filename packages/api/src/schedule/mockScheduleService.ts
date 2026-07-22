// packages/api/src/schedule/mockScheduleService.ts
import type { ScheduleService } from "./types";
import type {
  ScheduleResponseDto,
  CreateScheduleDto,
  UpdateScheduleDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockScheduleService loaded — v2 with 20 records (Conflict-Free Seed)");

function getMonday(date: Date): Date {
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return monday;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseTimeToMins(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

const rooms = ["Room 302", "AVR Laboratory", "Conference Room", "Room 105", "Faculty Lounge"];

const groupNames = [
  "Group 302", "Group Balaguer", "Group 101", "Group AVR", "Group Reyes",
  "Group Santos", "Group Cruz", "Group Bautista", "Group Tan", "Group Aguilar",
];

const researchTitles = [
  "Research Project 302", "ICS BSIT Research", "ICS Project 101",
  "AVR Research Initiative", "Smart Campus Monitoring System",
  "Blockchain Framework for Student Records", "IoT-Enabled Attendance System",
  "Machine Learning Grading Assistant", "Predictive Analytics for Enrollment",
  "Automated Thesis Plagiarism Checker",
];

const panelistPool = [
  "Dr. Roland Balmes", "Ms. Jane Doe", "Mr. Mark Luna", "Dr. Ana Reyes",
  "Prof. Carlo Santos", "Dr. Liza Cruz", "Mr. John Tan", "Ms. Grace Aguilar",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildSeed(): ScheduleResponseDto[] {
  const monday = getMonday(new Date());
  const schedules: ScheduleResponseDto[] = [];

  for (let i = 0; i < 20; i++) {
    const dayOffset = i % 5; // cycle Mon(0)..Fri(4), 4 schedules per day
    const scheduleDate = new Date(monday);
    scheduleDate.setDate(monday.getDate() + dayOffset);
    const dateStr = scheduleDate.toISOString().split("T")[0];
    const roomVenue = rooms[i % rooms.length];

    let startTotalMin = 0;
    let endTotalMin = 0;
    let hasConflict = true;
    let attempts = 0;

    // Re-roll time block until we find one that doesn't conflict
    while (hasConflict && attempts < 50) {
      hasConflict = false;
      
      // Randomize start hour within 8am–3pm so a 1–2.5hr block still fits the 8am–5pm grid
      const startHour = randomInt(8, 15);
      const startMinute = Math.random() < 0.5 ? 0 : 30;
      const durationMinutes = [60, 90, 120, 150][randomInt(0, 3)];
      
      startTotalMin = startHour * 60 + startMinute;
      endTotalMin = Math.min(startTotalMin + durationMinutes, 17 * 60); // cap at 5pm

      // Check against already assigned schedules for the same date and room
      for (const existing of schedules) {
        if (existing.date === dateStr && existing.roomVenue === roomVenue) {
          const eStart = parseTimeToMins(existing.startTime);
          const eEnd = parseTimeToMins(existing.endingTime);

          // Overlap check: New schedule starts before existing ends AND ends after existing starts
          if (startTotalMin < eEnd && endTotalMin > eStart) {
            hasConflict = true;
            break;
          }
        }
      }
      attempts++;
    }

    const startTime = `${pad(Math.floor(startTotalMin / 60))}:${pad(startTotalMin % 60)}`;
    const endTime = `${pad(Math.floor(endTotalMin / 60))}:${pad(endTotalMin % 60)}`;

    const scheduleId = (i + 1).toString();
    const groupIndex = i % groupNames.length;

    // Give every 3rd schedule a couple of panelists, rest none — mirrors the original mix
    const panelists =
      i % 3 === 0
        ? [
            { scheduleId, panelistId: panelistPool[randomInt(0, panelistPool.length - 1)], panelistType: "Adviser" },
            { scheduleId, panelistId: panelistPool[randomInt(0, panelistPool.length - 1)], panelistType: "Panelist" },
          ]
        : [];

    schedules.push({
      scheduleId,
      scheduledBy: "admin",
      date: dateStr,
      startTime,
      endingTime: endTime,
      roomVenue,
      researchGroup: {
        id: `g${i + 1}`,
        groupName: groupNames[groupIndex],
        researchTitle: researchTitles[groupIndex],
        adviserId: `adv${i + 1}`,
        leaderId: `lead${i + 1}`,
        createdAt: "2023-01-01",
        updatedAt: "2023-01-01",
      },
      panelists,
    });
  }

  return schedules;
}

const schedules = new Map<string, ScheduleResponseDto>();
buildSeed().forEach((s) => schedules.set(s.scheduleId, s));

export const mockScheduleService: ScheduleService = {
  async getSchedules() {
    await delay(300);
    return Array.from(schedules.values());
  },

  async getScheduleById(scheduleId: string) {
    await delay(150);
    return schedules.get(scheduleId) ?? null;
  },

  async createSchedule(dto: CreateScheduleDto) {
    await delay(300);
    const id = crypto.randomUUID();
    schedules.set(id, {
      scheduleId: id,
      scheduledBy: dto.scheduledBy,
      date: dto.date,
      startTime: dto.startTime,
      endingTime: dto.endingTime,
      roomVenue: dto.roomVenue,
      additionalInformation: dto.additionalInformation,
      panelists: dto.panelists.map((p) => ({ scheduleId: id, ...p })),
    });
    return true;
  },

  async updateSchedule(scheduleId: string, dto: UpdateScheduleDto) {
    await delay(300);
    const existing = schedules.get(scheduleId);
    if (!existing) return false;
    schedules.set(scheduleId, { ...existing, ...dto } as ScheduleResponseDto);
    return true;
  },

  async deleteSchedule(scheduleId: string) {
    await delay(200);
    return schedules.delete(scheduleId);
  },
};