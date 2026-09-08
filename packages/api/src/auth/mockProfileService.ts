import type { ProfileService } from "./profileService";
import type { AuthUser } from "@monteai/types";

const mockAdmin: AuthUser = {
  id: "mock-admin-1",
  email: "admin@montalban.edu.ph",
  firstName: "Mock",
  lastName: "Admin",
  position: "System Administrator",
  role: "Admin",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockProfileService: ProfileService = {
  async getCurrentProfile() {
    return mockAdmin;
  },
};
