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

export class LiveIdVerificationService implements IdVerificationService {
  private readonly endpoint?: string;
  private readonly getAuthToken: () => Promise<string | undefined>;
  private readonly refreshAuthToken?: () => Promise<string | undefined>;
  private readonly timeoutMs: number;

  constructor(config: IdVerificationServiceConfig) {
    this.endpoint = config.endpoint?.trim();
    this.getAuthToken = config.getAuthToken;
    this.refreshAuthToken = config.refreshAuthToken;
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

    const initialToken = await this.getAuthToken();
    if (!initialToken) {
      throw new IdVerificationError({
        code: "authentication_required",
        message: "Sign in again before verifying your ID.",
        status: 401,
      });
    }

    try {
      return await this.post(request, initialToken);
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        this.refreshAuthToken
      ) {
        const refreshedToken = await this.refreshAuthToken();
        if (refreshedToken) {
          try {
            return await this.post(request, refreshedToken);
          } catch (retryError) {
            throw sanitizeError(retryError);
          }
        }
      }
      throw sanitizeError(error);
    }
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
  if (error instanceof IdVerificationError) return error;
  if (axios.isAxiosError(error)) {
    const failure = error.response?.data as StudentIdVerificationFailure | undefined;
    const retryAfterRaw = error.response?.headers?.["retry-after"];
    const retryAfter = Number.parseInt(String(retryAfterRaw ?? ""), 10);
    return new IdVerificationError({
      code: typeof failure?.code === "string" ? failure.code : "service_unavailable",
      message:
        typeof failure?.message === "string"
          ? failure.message
          : "ID verification is temporarily unavailable.",
      outcome:
        failure?.outcome === "retake" || failure?.outcome === "unmatched"
          ? failure.outcome
          : "error",
      status: error.response?.status,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
    });
  }
  return new IdVerificationError({
    code: "service_unavailable",
    message: "ID verification is temporarily unavailable.",
  });
}
