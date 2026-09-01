import { createApiClient, createProgramHeadService } from "@monteai/api";

const client = createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL });

export const programHeadService = createProgramHeadService(
    client,
    import.meta.env.VITE_USE_MOCK === "true"
)