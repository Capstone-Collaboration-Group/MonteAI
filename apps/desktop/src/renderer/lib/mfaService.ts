import axios from "axios";
import { createMfaService } from "@monteai/api";
import { apiClient } from "./apiClient";

const baseURL = import.meta.env.VITE_API_BASE_URL;
const anonymousClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});
const useMock = import.meta.env.VITE_USE_MOCK === "true";

export const mfaService = createMfaService(apiClient, useMock);
export const anonymousMfaService = createMfaService(anonymousClient, useMock);
