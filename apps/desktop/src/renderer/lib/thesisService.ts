import { createApiClient, createThesisService } from "@monteai/api";

const client = createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL});

export const thesisService = createThesisService( 
    client,
    import.meta.env.VITE_USE_MOCK_SCHEDULE === "true",
)