// web/src/components/MfaStep.tsx
import { useState } from "react";
import { MfaVerifyStep } from "@monteai/ui";
import type { MfaVerifyResponse } from "@monteai/types";

interface MfaStepProps {
  verify: (code: string) => Promise<MfaVerifyResponse>;
  onCancel: () => void;
  error: string | null;
  pending: boolean;
}

/**
 * The 6-digit TOTP (or recovery-code) screen shown after Firebase sign-in
 * when the server reports MFA is enrolled. Uses the shared MfaVerifyStep
 * from @monteai/ui.
 */
export function MfaStep({ verify, onCancel, error, pending }: MfaStepProps) {
  const [recoveryMode, setRecoveryMode] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-on-surface">
        Two-Factor Authentication
      </h2>
      <p className="text-sm text-gray-500">
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>

      <MfaVerifyStep
        onVerify={verify}
        recoveryMode={recoveryMode}
        onUseRecoveryCode={() => setRecoveryMode(true)}
        onUseAuthenticator={() => setRecoveryMode(false)}
        helperText={
          recoveryMode
            ? "Enter one of the recovery codes you saved when you set up MFA."
            : undefined
        }
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="text-sm font-semibold text-primary transition hover:opacity-80 disabled:opacity-50"
      >
        Use a different account
      </button>
    </div>
  );
}
