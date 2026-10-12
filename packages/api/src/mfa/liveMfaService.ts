// packages/api/src/mfa/liveMfaService.ts

import type { AxiosInstance } from "axios";
import type { MfaCodeRequest, MfaVerifyRequest, MfaVerifyResponse } from "@monteai/types";
import type { MfaService } from "./types";

/**
 * Live MFA service. Endpoint paths mirror server/Controllers/MfaController.cs.
 *
 * All paths are relative to the client's baseURL (`https://localhost:7085/api/v1`).
 */
export class LiveMfaService implements MfaService {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  /**
   * The pending token travels in the request body, so the Firebase Bearer
   * header must be dropped for `verify`. `authOverride` accepts the raw
   * Firebase ID token for calls that must authenticate as the user (e.g.
   * `status` during settings), or `null` to send no Authorization header.
   */
  private override(authOverride?: string | null): { headers?: { Authorization?: string } } {
    if (authOverride === undefined) return {};
    return { headers: { Authorization: authOverride ? `Bearer ${authOverride}` : undefined } };
  }

  async challenge(authOverride?: string | null) {
    const { data } = await this.client.post("/auth/mfa/challenge", {}, this.override(authOverride));
    return data;
  }

  async status(authOverride?: string | null) {
    const { data } = await this.client.get("/auth/mfa/status", this.override(authOverride));
    return data;
  }

  async enroll(authOverride?: string | null) {
    const { data } = await this.client.post("/auth/mfa/enroll", {}, this.override(authOverride));
    return data;
  }

  async confirmEnroll(dto: MfaCodeRequest, authOverride?: string | null) {
    const { data } = await this.client.post("/auth/mfa/enroll/confirm", dto, this.override(authOverride));
    return data;
  }

  async disable(dto: MfaCodeRequest, authOverride?: string | null) {
    await this.client.post("/auth/mfa/disable", dto, this.override(authOverride));
  }

  async verify(dto: MfaVerifyRequest) {
    const { data } = await this.client.post<MfaVerifyResponse>("/auth/mfa/verify", dto, this.override(null));
    return data;
  }

  async regenerateRecoveryCodes(dto: MfaCodeRequest, authOverride?: string | null) {
    const { data } = await this.client.post("/auth/mfa/recovery-codes/regenerate", dto, this.override(authOverride));
    return data;
  }

  async refresh(refreshToken: string) {
    const { data } = await this.client.post("/auth/refresh", { refreshToken }, this.override(null));
    return data;
  }
}
