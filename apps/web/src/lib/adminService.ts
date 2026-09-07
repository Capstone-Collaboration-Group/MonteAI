import { createAdminService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const adminService = createAdminService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true"
);
