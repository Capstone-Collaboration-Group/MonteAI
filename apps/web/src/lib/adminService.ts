import { createApiClient, createAdminService } from "@monteai/api";

const client = createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL });

export const adminService = createAdminService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);
