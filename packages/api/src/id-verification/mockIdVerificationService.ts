import { IdVerificationError, type IdVerificationService } from "./types";

export const mockIdVerificationService: IdVerificationService = {
  async verifyStudentId(_request, options) {
    if (options?.signal?.aborted) {
      throw new IdVerificationError({ code: "cancelled", message: "ID verification was cancelled. Reopen the camera to try again." });
    }
    return {
      outcome: "verified",
      receipt: "mock-id-verification-receipt",
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      templateId: "cdm-front-v1",
      requestId: "mock-request",
    };
  },
};
