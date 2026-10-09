import { createStudentService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const studentService = createStudentService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);
