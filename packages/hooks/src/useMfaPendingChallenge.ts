// packages/hooks/src/useMfaPendingChallenge.ts
import { useContext } from "react";
import { MfaFlowContext, type MfaPendingChallenge } from "./mfaFlowContext";

/**
 * Read/write access to the pending MFA challenge. Returns `null` values when
 * no `<MfaFlowProvider>` is mounted, so callers outside the flow (e.g. the
 * desktop app, which has no MFA step yet) can no-op safely.
 */
export function useMfaPendingChallenge() {
  const flow = useContext(MfaFlowContext);
  return {
    pending: flow?.pending ?? null,
    setPending: (next: MfaPendingChallenge | null) => flow?.setPending(next),
    establishSession: flow?.onComplete,
  };
}
