// packages/api/src/mfa/index.ts

import type { AxiosInstance } from "axios";
import { LiveMfaService } from "./liveMfaService";
import { mockMfaService } from "./mockMfaService";
import type { MfaService } from "./types";

export function createMfaService(client: AxiosInstance, useMock: boolean): MfaService {
  return useMock ? mockMfaService : new LiveMfaService(client);
}

export type { MfaService } from "./types";
export type { AuthOverride } from "./types";
export { LiveMfaService } from "./liveMfaService";
export { mockMfaService, resetMockMfaState } from "./mockMfaService";
