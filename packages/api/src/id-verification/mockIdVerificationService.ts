import type { IdVerificationService } from "./types";

export const mockIdVerificationService: IdVerificationService = {
  async verifyStudentId() {
    return {
      outcome: "verified",
      receipt: "mock-id-verification-receipt",
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      templateId: "cdm-front-v1",
      requestId: "mock-request",
    };
  },
};
