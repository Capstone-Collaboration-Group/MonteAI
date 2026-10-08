// packages/api/src/user/mockUserService.ts

import type { UserProfileDto, UpdateProfileRequest } from "@monteai/types";
import type { UserService } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


let mockProfile: UserProfileDto = {
  id: "mock-uid-101",
  email: "jane.doe@student.pnm.edu.ph",
  firstName: "Jane",
  middleInitial: "B",
  lastName: "Doe",
  role: "Student",
  isActive: true,
  studentNumber: "2023-00001",
  institute: "ICS",
  program: "BS Information Technology",
  yearLevel: 3,
  section: "A",
  position: "Member",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

export const mockUserService: UserService = {
  async getMe() {
    await delay(250);
    return { ...mockProfile };
  },

  async updateMe(dto: UpdateProfileRequest) {
    await delay(300);
    mockProfile = {
      ...mockProfile,
      ...dto,
      middleInitial:
        dto.middleInitial === undefined
          ? mockProfile.middleInitial
          : dto.middleInitial,
      updatedAt: new Date().toISOString(),
    };
    return { ...mockProfile };
  },

  async revokeSessions() {
    await delay(300);
    return true;
  },
};
