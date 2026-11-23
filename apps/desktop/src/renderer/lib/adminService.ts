import { createAdminService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const adminService = createAdminService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
);
