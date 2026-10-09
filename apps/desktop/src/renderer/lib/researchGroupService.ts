import { createResearchGroupService } from "@monteai/api";
import { apiClient } from "./apiClient";

export const researchGroupService = createResearchGroupService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);
