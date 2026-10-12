// packages/ui/src/components/mfa/MfaVerifyStep.tsx
import { useState } from "react";
import type { MfaVerifyResponse } from "@monteai/types";
import { Card } from "../Card";
import { Button } from "../Button";
import { Alert } from "../common/Alert";
import { Spinner } from "../common/Spinner";
import { MfaCodeInput } from "./MfaCodeInput";

type MfaVerifyStepProps = {
  /** Verifies the code. Receives the entered code (TOTP or recovery code). */
  onVerify: (code: string) => Promise<unknown>;
  /** Lets the user swap between the 6-digit TOTP form and the recovery-code form. */
  onUseRecoveryCode?: () => void;
  onUseAuthenticator?: () => void;
  /** True when the recovery-code entry mode is active. */
  recoveryMode?: boolean;
  /** Optional helper shown above the field (e.g. "Enter the code from your app"). */
  helperText?: string;
  /** Called after a successful verify — carries the session tokens onward when present. */
  onSuccess?: (result: MfaVerifyResponse) => void;
};

/**
 * The 6-digit verification step shown after Firebase sign-in for a
 * TOTP-enrolled user (and in the setup flow before enroll/confirm).
 *
 * Submit is disabled until 6 digits are entered, or any non-empty string is
 * accepted when in recovery-code mode (recovery codes are 11 chars with a
 * dash, entered via a plain text input).
 */
export function MfaVerifyStep({
  onVerify,
  onUseRecoveryCode,
  onUseAuthenticator,
  recoveryMode = false,
  helperText,
  onSuccess,
}: MfaVerifyStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = recoveryMode
    ? code.trim().length >= 8
    : code.length === 6;

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = (await onVerify(trimmed)) as MfaVerifyResponse | undefined;
      if (result) onSuccess?.(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid code. Try again.";
      setError(message);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-on-surface">
          {recoveryMode ? "Enter a recovery code" : "Enter your authenticator code"}
        </h3>
        {helperText && (
          <p className="text-sm text-on-surface-variant">{helperText}</p>
        )}
      </div>

      {error && <Alert variant="error" title="Verification failed" message={error} />}

      {recoveryMode ? (
        <input
          type="text"
          value={code}
          disabled={submitting}
          autoComplete="off"
          placeholder="XXXXX-XXXXX"
          aria-label="Recovery code"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) void submit(code);
          }}
          className="h-12 w-full rounded-xl border border-outline-variant bg-white px-4 text-base text-on-surface outline-none transition-all duration-200 placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      ) : (
        <MfaCodeInput
          value={code}
          onChange={setCode}
          onComplete={(v) => void submit(v)}
          disabled={submitting}
          autoFocus
          error={!!error}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {recoveryMode ? (
            onUseAuthenticator && (
              <button
                type="button"
                onClick={onUseAuthenticator}
                disabled={submitting}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                Use authenticator code
              </button>
            )
          ) : (
            onUseRecoveryCode && (
              <button
                type="button"
                onClick={onUseRecoveryCode}
                disabled={submitting}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                Use a recovery code
              </button>
            )
          )}
        </div>

        <Button
          onClick={() => void submit(code)}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <Spinner size="sm" variant="current" /> : "Verify"}
        </Button>
      </div>
    </Card>
  );
}
