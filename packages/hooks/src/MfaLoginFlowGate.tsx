// packages/hooks/src/MfaLoginFlowGate.tsx
import { useCallback, useContext, useState } from "react";
import type { MfaVerifyResponse } from "@monteai/types";
import { MfaFlowContext } from "./mfaFlowContext";

interface MfaLoginFlowGateProps {
  /**
   * The app's anonymous verify (POST /auth/mfa/verify via its MfaService).
   * Receives the pending token + entered code.
   */
  verifyMfa: (input: { pendingToken: string; code: string }) => Promise<MfaVerifyResponse>;
  /** Renders the code-entry UI (shared `MfaVerifyStep` or a native one). */
  children: (props: {
    verify: (code: string) => Promise<MfaVerifyResponse>;
    onCancel: () => void;
    error: string | null;
    pending: boolean;
  }) => React.ReactNode;
}

/**
 * Renders its children only while an MFA challenge is pending — i.e. the
 * app has signed the user into Firebase but the server says TOTP is
 * required. The `verify` callback it hands down posts the pending token +
 * code to the app's MFA service (anonymous) and forwards the result to the
 * provider's `onComplete`.
 *
 * When there is no pending challenge this renders nothing, so the app's
 * normal screen tree shows through.
 */
export function MfaLoginFlowGate({ verifyMfa, children }: MfaLoginFlowGateProps) {
  const flow = useContext(MfaFlowContext);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerify, setPendingVerify] = useState(false);

  const verify = useCallback(
    async (code: string): Promise<MfaVerifyResponse> => {
      if (!flow?.pending) {
        throw new Error("Your sign-in session expired. Please sign in again.");
      }
      setPendingVerify(true);
      setError(null);
      try {
        const result = await verifyMfa({
          pendingToken: flow.pending.pendingToken,
          code,
        });
        await flow.onComplete(result);
        flow.setPending(null);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid code. Try again.";
        setError(message);
        throw err;
      } finally {
        setPendingVerify(false);
      }
    },
    [flow, verifyMfa],
  );

  const onCancel = useCallback(() => {
    flow?.pending?.onCancel?.();
    flow?.setPending(null);
    setError(null);
  }, [flow]);

  if (!flow?.pending) return null;

  return <>{children({ verify, onCancel, error, pending: pendingVerify })}</>;
}
