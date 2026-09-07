import { createFacultyService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const facultyService = createFacultyService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
);