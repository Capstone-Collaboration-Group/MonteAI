// packages/api/src/mfa/mockMfaService.ts

import type {
  MfaChallengeResponse,
  MfaCodeRequest,
  MfaConfirmEnrollResponse,
  MfaEnrollResponse,
  MfaRegenerateResponse,
  MfaStatusResponse,
  MfaVerifyResponse,
  RefreshResponse,
  UserProfileDto,
} from "@monteai/types";
import type { MfaService } from "./types";

const MOCK_TOTP_CODE = "123456";
const MOCK_RECOVERY_CODE_PREFIX = "MOCK";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeMockUser(): UserProfileDto {
  return {
    id: "mock-uid",
    email: "mock.user@pnm.edu.ph",
    firstName: "Mock",
    lastName: "User",
    role: "Student",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTokens() {
  return {
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

interface MockState {
  enabled: boolean;
  secret: string | null;
  pendingToken: string | null;
  recoveryCodes: string[];
}

const state: MockState = {
  enabled: false,
  secret: null,
  pendingToken: null,
  recoveryCodes: [],
};

/**
 * In-memory MFA service for `VITE_USE_MOCK=true` dev. Enforces the same
 * 6-digit-code and single-use-recovery-code rules as the live backend, so
 * the UI can be exercised without a server.
 */
export const mockMfaService: MfaService = {
  async challenge(): Promise<MfaChallengeResponse> {
    await delay(200);
    if (!state.enabled) {
      return { mfaRequired: false };
    }
    state.pendingToken = `mock-pending-${Date.now()}`;
    return { mfaRequired: true, pendingToken: state.pendingToken };
  },

  async status(): Promise<MfaStatusResponse> {
    await delay(150);
    return {
      totpEnabled: state.enabled,
      recoveryCodesRemaining: state.recoveryCodes.length,
    };
  },

  async enroll(): Promise<MfaEnrollResponse> {
    await delay(250);
    state.secret = "MOCKSECRET"; // base32 placeholder
    return {
      secret: state.secret,
      otpauthUri: `otpauth://totp/MonteAI:mock.user@pnm.edu.ph?secret=${state.secret}&issuer=MonteAI`,
    };
  },

  async confirmEnroll(dto: MfaCodeRequest): Promise<MfaConfirmEnrollResponse> {
    await delay(250);
    if (!state.secret || dto.code.trim() !== MOCK_TOTP_CODE) {
      throw new Error("Invalid code. Try again.");
    }
    state.enabled = true;
    state.pendingToken = `mock-pending-${Date.now()}`;
    state.recoveryCodes = [
      `${MOCK_RECOVERY_CODE_PREFIX}-AAAAA-BBBBB`,
      `${MOCK_RECOVERY_CODE_PREFIX}-CCCCC-DDDDD`,
      `${MOCK_RECOVERY_CODE_PREFIX}-EEEEE-FFFFF`,
    ];
    return { ...makeTokens(), recoveryCodes: state.recoveryCodes, user: makeMockUser() };
  },

  async disable(dto: MfaCodeRequest): Promise<void> {
    await delay(200);
    if (!state.enabled || dto.code.trim() !== MOCK_TOTP_CODE) {
      throw new Error("Invalid code. Try again.");
    }
    state.enabled = false;
    state.secret = null;
    state.pendingToken = null;
    state.recoveryCodes = [];
  },

  async verify(dto: { pendingToken: string; code: string }): Promise<MfaVerifyResponse> {
    await delay(300);
    if (!state.pendingToken || dto.pendingToken !== state.pendingToken) {
      throw new Error("Your sign-in session expired. Please sign in again.");
    }
    const code = dto.code.trim();
    const isTotp = code === MOCK_TOTP_CODE;
    const isRecovery = state.recoveryCodes.includes(code);
    if (!isTotp && !isRecovery) {
      throw new Error("Invalid code.");
    }
    if (isRecovery) {
      state.recoveryCodes = state.recoveryCodes.filter((c) => c !== code);
    }
    state.pendingToken = null;
    const tokens = makeTokens();
    return { ...tokens, user: makeMockUser() };
  },

  async regenerateRecoveryCodes(dto: MfaCodeRequest): Promise<MfaRegenerateResponse> {
    await delay(200);
    if (!state.enabled || dto.code.trim() !== MOCK_TOTP_CODE) {
      throw new Error("Invalid code. Try again.");
    }
    state.recoveryCodes = [
      `${MOCK_RECOVERY_CODE_PREFIX}-GGGGG-HHHHH`,
      `${MOCK_RECOVERY_CODE_PREFIX}-IIIII-JJJJJ`,
      `${MOCK_RECOVERY_CODE_PREFIX}-KKKKK-LLLLL`,
    ];
    return { recoveryCodes: state.recoveryCodes };
  },

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    await delay(150);
    if (!refreshToken.startsWith("mock-refresh-")) {
      throw new Error("Invalid or expired refresh token.");
    }
    return makeTokens();
  },
};

/** Dev/test helper — reset mock MFA state between tests/sessions. */
export function resetMockMfaState(): void {
  state.enabled = false;
  state.secret = null;
  state.pendingToken = null;
  state.recoveryCodes = [];
}
