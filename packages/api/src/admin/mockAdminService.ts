// packages/api/src/admin/mockAdminService.ts

import type { AdminService } from "./types";
import type {
  AdminResponseDto,
  UpdateAdminDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockAdminService loaded — Initialized with seed data");

function buildSeed(): AdminResponseDto[] {
  return [
    {
      id: "admin-1",
      email: "juan.delacruz@monteai.edu",
      firstName: "Juan",
      middleInitial: "D",
      lastName: "Dela Cruz",
      suffix: "",
      position: "Research Coordinator",
      role: "Admin",
      isActive: true,
      createdAt: "2024-01-15T08:00:00.000Z",
      updatedAt: "2024-01-15T08:00:00.000Z",
    },
    {
      id: "admin-2",
      email: "maria.santos@monteai.edu",
      firstName: "Maria",
      middleInitial: "L",
      lastName: "Santos",
      suffix: "",
      position: "Department Secretary",
      role: "Admin",
      isActive: true,
      createdAt: "2024-02-10T09:30:00.000Z",
      updatedAt: "2024-02-10T09:30:00.000Z",
    },
    {
      id: "admin-3",
      email: "robert.garcia@monteai.edu",
      firstName: "Robert",
      middleInitial: "P",
      lastName: "Garcia",
      suffix: "Jr.",
      position: "System Administrator",
      role: "Super Admin",
      isActive: true,
      createdAt: "2024-03-05T10:15:00.000Z",
      updatedAt: "2024-03-05T10:15:00.000Z",
    },
  ];
}

const adminsMap = new Map<string, AdminResponseDto>();

buildSeed().forEach((admin) => adminsMap.set(admin.id, admin));

export const mockAdminService: AdminService = {
  async getAdmins() {
    await delay(300);
    return Array.from(adminsMap.values());
  },

  async getAdmin(adminId: string) {
    await delay(150);
    return adminsMap.get(adminId) ?? null;
  },

  async updateAdmin(adminId: string, dto: UpdateAdminDto) {
    await delay(300);

    const existing = adminsMap.get(adminId);

    if (!existing) {
      return false;
    }

    adminsMap.set(adminId, {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString(),
    });

    return true;
  },
};