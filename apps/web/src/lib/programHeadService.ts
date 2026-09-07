import { createProgramHeadService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const programHeadService = createProgramHeadService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true"
);
