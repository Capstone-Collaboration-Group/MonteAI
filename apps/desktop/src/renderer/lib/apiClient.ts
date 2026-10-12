import axios from "axios";
import { auth } from "./firebaseServices";

type TokenProvider = () => Promise<string | undefined>;
let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use(async (config) => {
  if (config.headers.has("Authorization")) return config;
  const sessionToken = await tokenProvider?.();
  const token = sessionToken ?? await auth.currentUser?.getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});