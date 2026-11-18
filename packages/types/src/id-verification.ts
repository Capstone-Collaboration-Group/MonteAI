export interface StudentIdVerificationIdentity {
  studentNumber: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
}

export interface StudentIdVerificationRequest {
  student: StudentIdVerificationIdentity;
  /** In-memory JPEG/PNG base64, without a data-URL prefix. Never store, log, or report captures. */
  imageBase64: string;
}

export interface StudentIdVerificationResponse {
  outcome: "verified";
  /** Sensitive, unencrypted 600-second JWT. Memory only; never storage, URLs, logs, or analytics. */
  receipt: string;
  expiresAt: string;
  templateId: string;
  requestId: string;
}

export interface StudentIdVerificationFailure {
  outcome: "error" | "retake" | "unmatched";
  code: string;
  message: string;
  requestId?: string;
}
