// packages/hooks/src/mfaFlowContext.ts
import { createContext } from "react";
import type { AuthTokens } from "@monteai/types";

/**
 * Pending (pre-verify) login state. Apps that render an MFA step after
 * Firebase sign-in must publish it here so the shared
 * `<MfaLoginFlowGate>` can take over.
 *
 * React 19 supports plain promises / ref-like objects as context values,
 * so this is set once per step and never re-renders the provider.
 */
export interface MfaPendingChallenge {
  /** Firebase ID token for the just-signed-in user (kept for the challenge). */
  idToken: string;
  /** Anonymous token returned by POST /auth/mfa/challenge. */
  pendingToken: string;
  /** Fire-and-forget: revoke the Firebase session before the code step. */
  onCancel?: () => void;
}

export interface MfaFlowContextValue {
  pending: MfaPendingChallenge | null;
  setPending: (next: MfaPendingChallenge | null) => void;
  /** Completes the verify step — implemented by the app's session layer. */
  onComplete: (result: AuthTokens) => void | Promise<void>;
}

export const MfaFlowContext = createContext<MfaFlowContextValue | null>(null);
