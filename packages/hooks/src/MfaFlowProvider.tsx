// packages/hooks/src/MfaFlowProvider.tsx
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { AuthTokens } from "@monteai/types";
import { MfaFlowContext, type MfaPendingChallenge } from "./mfaFlowContext";

interface MfaFlowProviderProps {
  /** Completes the MFA login — persists tokens, opens the app session. */
  onComplete: (result: AuthTokens) => void | Promise<void>;
  children: ReactNode;
}

/**
 * Publishes the pending MFA challenge (set by the app right after Firebase
 * sign-in) to any `<MfaLoginFlowGate>` mounted lower in the tree.
 *
 * Keeping the pending token on a ref (not state) means stepping into the
 * code screen does not re-render the whole provider subtree — the gate reads
 * it via `use(MfaFlowContext)` only when it is actually mounted.
 */
export function MfaFlowProvider({ onComplete, children }: MfaFlowProviderProps) {
  const [pending, setPendingState] = useState<MfaPendingChallenge | null>(null);

  // `setPending` is only called from event handlers, so this is safe under
  // the react-hooks rule (no setState-in-effect).
  const setPending = useCallback((next: MfaPendingChallenge | null) => {
    setPendingState(next);
  }, []);

  const value = useMemo(
    () => ({ pending, setPending, onComplete }),
    [pending, setPending, onComplete],
  );

  return <MfaFlowContext.Provider value={value}>{children}</MfaFlowContext.Provider>;
}
