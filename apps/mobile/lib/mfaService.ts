import axios from 'axios';
import { createApiClient, createMfaService } from '@monteai/api';
import { getAuthToken, refreshAuthToken } from './authService';

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.100.9:5084/api/v1';
const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? 'true' : 'false')) === 'true';
const authenticatedClient = createApiClient({ baseURL, getAuthToken, refreshAuthToken });
const anonymousClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const mfaService = createMfaService(authenticatedClient, useMock);
export const anonymousMfaService = createMfaService(anonymousClient, useMock);
