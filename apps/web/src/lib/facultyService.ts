import { createFacultyService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const facultyService = createFacultyService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);
