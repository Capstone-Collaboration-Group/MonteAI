// packages/ui/src/components/mfa/MfaEnrollStep.tsx
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { MfaEnrollResponse } from "@monteai/types";
import { Card } from "../Card";
import { Button } from "../Button";
import { Alert } from "../common/Alert";
import { Spinner } from "../common/Spinner";
import { MfaCodeInput } from "./MfaCodeInput";

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "object" && data !== null) {
      const details = data as { message?: unknown; Message?: unknown; title?: unknown };
      for (const value of [details.message, details.Message, details.title]) {
        if (typeof value === "string" && value.trim()) return value;
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}

type MfaEnrollStepProps = {
  /** Fetches the TOTP secret + otpauth URI (POST /auth/mfa/enroll). */
  onEnroll: () => Promise<MfaEnrollResponse>;
  /** Confirms activation with the 6-digit code (POST /auth/mfa/enroll/confirm). */
  onConfirm: (code: string) => Promise<{ recoveryCodes: string[] }>;
  /** Called once the user has acknowledged the recovery codes. */
  onDone?: () => void;
};

/**
 * Setup flow step 1–2: fetch the secret, render a QR code + manual-entry
 * secret, then collect the 6-digit code to activate. The recovery codes
 * returned on success are handed back via `onDone`'s parent state (they are
 * never stored here).
 */
export function MfaEnrollStep({ onEnroll, onConfirm, onDone }: MfaEnrollStepProps) {
  const enrollmentRequest = useRef<Promise<MfaEnrollResponse> | null>(null);
  const confirmationInFlight = useRef(false);
  const [enroll, setEnroll] = useState<MfaEnrollResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      setFetchError(null);
      try {
        enrollmentRequest.current ??= onEnroll();
        const result = await enrollmentRequest.current;
        if (!cancelled) setEnroll(result);
      } catch (err) {
        enrollmentRequest.current = null;
        if (!cancelled) {
          setFetchError(getErrorMessage(err, "Could not start setup."));
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onEnroll]);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length !== 6 || confirmationInFlight.current) return;
    confirmationInFlight.current = true;
    setConfirming(true);
    setConfirmError(null);
    try {
      await onConfirm(trimmed);
      onDone?.();
    } catch (err) {
      setConfirmError(getErrorMessage(err, "Invalid code. Try again."));
      setCode("");
    } finally {
      confirmationInFlight.current = false;
      setConfirming(false);
    }
  };

  if (fetching) {
    return (
      <Card className="flex items-center justify-center gap-3 py-10">
        <Spinner size="lg" />
        <span className="text-sm text-on-surface-variant">Preparing setup…</span>
      </Card>
    );
  }

  if (fetchError || !enroll) {
    return (
      <Card className="flex flex-col gap-3">
        <Alert variant="error" title="Setup failed" message={fetchError ?? "Could not start setup."} />
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-on-surface">Set up your authenticator app</h3>
        <p className="text-sm text-on-surface-variant">
          Scan the QR code with Google Authenticator, Authy, or any TOTP-compatible app, then enter the 6-digit code it shows.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-outline-variant bg-white p-3">
          <QRCodeSVG value={enroll.otpauthUri} size={160} level="M" includeMargin={false} />
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Can&apos;t scan? Enter this key
            </p>
            <p className="mt-1 break-all rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-sm text-on-surface">
              {enroll.secret}
            </p>
          </div>
        </div>
      </div>

      {confirmError && <Alert variant="error" title="Verification failed" message={confirmError} />}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-on-surface">Enter the 6-digit code</p>
        <MfaCodeInput
          value={code}
          onChange={setCode}
          onComplete={(v) => void submit(v)}
          disabled={confirming}
          error={!!confirmError}
        />
        <div className="flex justify-end">
          <Button onClick={() => void submit(code)} disabled={code.length !== 6 || confirming}>
            {confirming ? <Spinner size="sm" variant="current" /> : "Verify and activate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
