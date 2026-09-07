import { createProgramHeadService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const programHeadService = createProgramHeadService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
)