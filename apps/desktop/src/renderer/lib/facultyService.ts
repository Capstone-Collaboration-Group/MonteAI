import { createApiClient, createFacultyService } from "@monteai/api";

const client = createApiClient({ baseURL: import.meta.env.API_BASE_URL });

export const facultyService = createFacultyService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
);