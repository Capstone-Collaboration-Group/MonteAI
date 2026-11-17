export interface StudentIdVerificationIdentity {
  studentNumber: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
}

export interface StudentIdVerificationRequest {
  student: StudentIdVerificationIdentity;
  /** Raw JPEG/PNG bytes encoded as base64; never include a data-URL prefix. */
  imageBase64: string;
}

export interface StudentIdVerificationResponse {
  outcome: "verified";
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
