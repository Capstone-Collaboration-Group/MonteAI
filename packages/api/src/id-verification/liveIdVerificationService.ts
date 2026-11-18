import axios from "axios";
import type {
  StudentIdVerificationFailure,
  StudentIdVerificationRequest,
  StudentIdVerificationResponse,
} from "@monteai/types";
import type {
  IdVerificationService,
  IdVerificationServiceConfig,
} from "./types";
import { IdVerificationError } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

// Keep the service's stable codes, but never trust arbitrary response messages with capture data.
const SAFE_MESSAGES: Record<string, string> = {
  client_not_configured: "ID verification is not configured for this application.",
  invalid_request: "Check the registration details and capture format.",
  image_too_large: "Capture the ID again at a lower resolution.",
  unsupported_image: "Capture a JPEG or PNG image of the front of your ID.",
  authentication_required: "Sign in again before verifying your ID.",
  email_unverified: "Verify your email, then refresh your session.",
  origin_not_allowed: "This application is not configured for ID verification.",
  card_not_found: "Place the entire front of the ID inside the guide and retake.",
  image_quality: "Retake in even lighting, keeping the card still and in focus.",
  school_unreadable: "Retake with the school heading clearly visible.",
  name_unreadable: "Retake with your complete printed name clearly visible.",
  number_unreadable: "Retake with your student number clearly visible.",
  template_unmatched: "The capture does not match the supported school-ID design.",
  student_number_mismatch: "The printed student number does not match registration.",
  student_name_mismatch: "The printed name does not match registration.",
  daily_limit: "Today's ID-verification attempt limit has been reached.",
  user_limit: "Your monthly ID-verification attempt limit has been reached.",
  monthly_limit: "ID verification has reached its monthly service allowance.",
  busy: "ID verification is busy. Try again shortly.",
  verification_timeout: "Verification took too long. Please try again.",
  service_unavailable: "ID verification is temporarily unavailable.",
  verification_disabled: "ID verification is temporarily paused.",
};

export class LiveIdVerificationService implements IdVerificationService {
  private readonly endpoint?: string;
  private readonly getFreshFirebaseIdToken: () => Promise<string | undefined>;
  private readonly timeoutMs: number;

  constructor(config: IdVerificationServiceConfig) {
    this.endpoint = config.endpoint?.trim();
    this.getFreshFirebaseIdToken = config.getFreshFirebaseIdToken;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async verifyStudentId(
    request: StudentIdVerificationRequest,
  ): Promise<StudentIdVerificationResponse> {
    if (!this.endpoint) {
      throw new IdVerificationError({
        code: "client_not_configured",
        message: "ID verification is not configured for this application.",
      });
    }

    try {
      const initialToken = await this.requireFreshToken();
      try {
        return await this.post(request, initialToken);
      } catch (error) {
        // Authentication rejection occurs before OCR/quota admission. Retry it once only.
        // Do not automatically retry scans on quota, mismatch, timeout, or network failures.
        if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
        return await this.post(request, await this.requireFreshToken());
      }
    } catch (error) {
      throw sanitizeError(error);
    }
  }

  private async requireFreshToken(): Promise<string> {
    const token = await this.getFreshFirebaseIdToken();
    if (!token) {
      throw new IdVerificationError({
        code: "authentication_required",
        message: SAFE_MESSAGES.authentication_required,
        status: 401,
      });
    }
    return token;
  }

  private async post(
    request: StudentIdVerificationRequest,
    token: string,
  ): Promise<StudentIdVerificationResponse> {
    const { data } = await axios.post<StudentIdVerificationResponse>(
      this.endpoint!,
      request,
      {
        timeout: this.timeoutMs,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return data;
  }
}

function sanitizeError(error: unknown): IdVerificationError {
  if (error instanceof IdVerificationError || axios.isAxiosError(error)) {
    const failure = error instanceof IdVerificationError
      ? error
      : error.response?.data as StudentIdVerificationFailure | undefined;
    const status = error instanceof IdVerificationError ? error.status : error.response?.status;
    const retryAfterRaw = error instanceof IdVerificationError
      ? error.retryAfterSeconds
      : error.response?.headers?.["retry-after"];
    const retryAfter = typeof retryAfterRaw === "number" ||
      (typeof retryAfterRaw === "string" && /^\d+$/.test(retryAfterRaw))
      ? Number(retryAfterRaw)
      : NaN;
    const known = typeof failure?.code === "string" &&
      Object.prototype.hasOwnProperty.call(SAFE_MESSAGES, failure.code);
    const code = known ? failure!.code : status === 401 ? "authentication_required" : "service_unavailable";
    return new IdVerificationError({
      code,
      message: SAFE_MESSAGES[code],
      outcome:
        known && (failure?.outcome === "retake" || failure?.outcome === "unmatched")
          ? failure.outcome
          : "error",
      status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : undefined,
      retryAfterSeconds: Number.isSafeInteger(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
    });
  }
  return new IdVerificationError({
    code: "service_unavailable",
    message: "ID verification is temporarily unavailable.",
  });
}
