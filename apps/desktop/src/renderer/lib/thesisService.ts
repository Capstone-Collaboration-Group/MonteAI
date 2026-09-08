import { createThesisService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const thesisService = createThesisService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);