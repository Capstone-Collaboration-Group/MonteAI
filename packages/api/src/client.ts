// packages/api/src/client.ts
import axios, { type AxiosInstance } from "axios";

export interface ApiClientConfig {
  baseURL: string;
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  timeout?: number;
}

export function createApiClient({ baseURL, getAuthToken, timeout = 10000 }: ApiClientConfig): AxiosInstance {
  const client = axios.create({ baseURL, timeout });

  client.interceptors.request.use(async (config) => {
    const token = await getAuthToken?.();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
}