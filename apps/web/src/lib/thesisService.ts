import { createThesisService } from "@monteai/api";
import { apiClient } from "./firebaseServices"; 

export const thesisService = createThesisService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true"
);

