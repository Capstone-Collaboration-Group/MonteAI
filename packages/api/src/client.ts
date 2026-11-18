import axios, { type AxiosInstance, isAxiosError } from "axios";
import type { AxiosRequestConfig } from "axios";
export interface ApiClientConfig {
  baseURL: string;
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  refreshAuthToken?: () => Promise<string | undefined>;
  onAuthExpired?: () => void;
  timeout?: number;
  httpsAgent?: unknown
}

export function createApiClient({
  baseURL,
  getAuthToken,
  refreshAuthToken,
  onAuthExpired,
  timeout = 10000,
  httpsAgent, 
}: ApiClientConfig): AxiosInstance {
  const client = axios.create({ 
    baseURL, 
    timeout, 
    httpsAgent, 
    headers: {
      'Content-Type': 'application/json',
} });

  type RetriableRequestConfig = AxiosRequestConfig & {
    _retried?: boolean;
    _explicitAuthorization?: boolean;
  };
  client.interceptors.request.use(async (config) => {
    const request = config as typeof config & RetriableRequestConfig;
    if (request._explicitAuthorization === undefined) {
      request._explicitAuthorization = config.headers.has("Authorization");
    }
    // Explicit Firebase registration tokens (and freshly retried tokens) must not be
    // replaced by the default provider, which may return an MFA session JWT.
    if (!config.headers.has("Authorization")) {
      const token = await getAuthToken?.();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  let refreshPromise: Promise<string | undefined> | null = null;

  client.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !refreshAuthToken) {
      throw error;
    }

    const original = error.config as RetriableRequestConfig | undefined;
    // The caller owns explicitly supplied credentials; do not retry them with an MFA token.
    if (original?._explicitAuthorization) throw error;
    if (!original || original._retried) {
      onAuthExpired?.();
      throw error;
    }
    original._retried = true;

    if (!refreshPromise) {
      refreshPromise = refreshAuthToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (!newToken) {
      onAuthExpired?.();
      throw error;
    }

      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return client(original);
    }
  );

  return client;
}
