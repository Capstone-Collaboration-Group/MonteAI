import type {
  StudentIdVerificationRequest,
  StudentIdVerificationResponse,
} from "@monteai/types";

export interface IdVerificationService {
  verifyStudentId(
    request: StudentIdVerificationRequest,
    options?: IdVerificationRequestOptions,
  ): Promise<StudentIdVerificationResponse>;
}

export interface IdVerificationRequestOptions {
  /** Abort on cancellation, navigation, backgrounding, or identity edits. */
  signal?: AbortSignal;
}

export interface IdVerificationServiceConfig {
  /** Full POST endpoint, including /api/v1/id-verification. */
  endpoint?: string;
  /** Firebase only: reload the user and getIdToken(true). Do not use an MFA/session provider. */
  getFreshFirebaseIdToken: () => Promise<string | undefined>;
  useMock?: boolean;
  timeoutMs?: number;
}

export class IdVerificationError extends Error {
  readonly code: string;
  readonly outcome: "error" | "retake" | "unmatched";
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(input: {
    code: string;
    message: string;
    outcome?: "error" | "retake" | "unmatched";
    status?: number;
    retryAfterSeconds?: number;
  }) {
    super(input.message);
    this.name = "IdVerificationError";
    this.code = input.code;
    this.outcome = input.outcome ?? "error";
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}
