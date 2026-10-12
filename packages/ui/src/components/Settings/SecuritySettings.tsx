import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "@monteai/hooks";
import { useMfaPendingChallenge } from "@monteai/hooks";
import type {
  MfaStatusResponse,
  MfaEnrollResponse,
  MfaConfirmEnrollResponse,
  MfaRegenerateResponse,
} from "@monteai/types";

import { Card } from "../Card";
import { Input } from "../Input";
import { Button } from "../Button";
import { showToast } from "../common";
import { Alert } from "../common/Alert";
import { MfaEnrollStep } from "../mfa/MfaEnrollStep";
import { MfaVerifyStep } from "../mfa/MfaVerifyStep";
import { MfaRecoveryCodes } from "../mfa/MfaRecoveryCodes";

/**
 * The MFA API client is app-owned (it needs the axios instance + mock flag),
 * so the app injects it. Keeping this a required prop means packages/ui never
 * imports @monteai/api and stays a pure presentation layer.
 */
export interface MfaApi {
  status: () => Promise<MfaStatusResponse>;
  enroll: () => Promise<MfaEnrollResponse>;
  confirmEnroll: (code: string) => Promise<MfaConfirmEnrollResponse>;
  disable: (code: string) => Promise<void>;
  regenerateRecoveryCodes: (code: string) => Promise<MfaRegenerateResponse>;
}

interface SecuritySettingsProps {
  /** Injected by the app; omit to hide the MFA section entirely. */
  mfa?: MfaApi;
}

export function SecuritySettings({ mfa }: SecuritySettingsProps) {
  const { user } = useAuth();
  const { establishSession } = useMfaPendingChallenge();
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  // MFA state. Loading and error are derived from `mfaStatus` so the effect
  // below only ever calls setState from async callbacks (react-hooks rule).
  const [mfaStatus, setMfaStatus] = useState<
    | { loading: true }
    | { loading: false; status: MfaStatusResponse | null; error: string | null }
  >({ loading: true });
  const [mfaMode, setMfaMode] = useState<"idle" | "enroll" | "disable" | "recovery">("idle");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!mfa) return;
    let cancelled = false;
    mfa
      .status()
      .then((status) => {
        if (!cancelled) setMfaStatus({ loading: false, status, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMfaStatus({
            loading: false,
            status: null,
            error: err instanceof Error ? err.message : "Could not load MFA status.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mfa]);

  const handleStartEnroll = () => {
    setRecoveryCodes(null);
    setMfaMode("enroll");
  };

  const handleConfirmEnroll = async (code: string): Promise<MfaConfirmEnrollResponse> => {
    if (!mfa) throw new Error("MFA is unavailable.");
    const result = await mfa.confirmEnroll(code);
    if (!establishSession) {
      throw new Error("Could not establish the protected session. Please sign in again.");
    }
    await establishSession(result);
    setRecoveryCodes(result.recoveryCodes);
    const status = await mfa.status();
    setMfaStatus({ loading: false, status, error: null });
    setMfaMode("idle");
    showToast({
      title: "Two-factor enabled",
      description: "Save your recovery codes before you leave this page.",
      type: "success",
    });
    return result;
  };

  const handleDisable = async (code: string): Promise<void> => {
    if (!mfa) throw new Error("MFA is unavailable.");
    await mfa.disable(code);
    const status = await mfa.status();
    setMfaStatus({ loading: false, status, error: null });
    setMfaMode("idle");
    showToast({
      title: "Two-factor disabled",
      description: "You will no longer need a code to sign in.",
      type: "success",
    });
  };

  const handleRegenerateRecoveryCodes = async (code: string): Promise<void> => {
    if (!mfa) throw new Error("MFA is unavailable.");
    const result = await mfa.regenerateRecoveryCodes(code);
    setRecoveryCodes(result.recoveryCodes);
    const status = await mfa.status();
    setMfaStatus({ loading: false, status, error: null });
    setMfaMode("idle");
    showToast({
      title: "Recovery codes regenerated",
      description: "Save the new codes now. Previous codes are no longer valid.",
      type: "success",
    });
  };

  const handleSave = async () => {
    if (saving) return;

    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      showToast({
        title: "Missing fields",
        description: "Fill in all three password fields.",
        type: "error",
      });
      return;
    }
    if (passwords.newPassword.length < 6) {
      showToast({
        title: "Password too short",
        description: "New password must be at least 6 characters.",
        type: "error",
      });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      showToast({
        title: "Passwords do not match",
        description: "New password and confirmation must match.",
        type: "error",
      });
      return;
    }
    if (!user?.email) {
      showToast({
        title: "Session expired",
        description: "Please sign in again to change your password.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        passwords.currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwords.newPassword);

      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
        type: "success",
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        showToast({
          title: "Incorrect password",
          description: "Your current password is incorrect.",
          type: "error",
        });
      } else if (code === "auth/requires-recent-login") {
        showToast({
          title: "Session expired",
          description: "Please sign out and sign in again, then retry.",
          type: "error",
        });
      } else {
        showToast({
          title: "Update failed",
          description: "Your password could not be changed. Please try again.",
          type: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const mfaLoading = mfaStatus.loading === true;
  const mfaError = mfaStatus.loading === true ? null : mfaStatus.error;
  const status = mfaStatus.loading === true ? null : mfaStatus.status;
  const totpEnabled = status?.totpEnabled ?? false;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">
          Security
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Manage your account security.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">
            Current Password
          </span>

          <Input
            type="password"
            value={passwords.currentPassword}
            onChange={(event) =>
              setPasswords((current) => ({
                ...current,
                currentPassword: event.target.value,
              }))
            }
            placeholder="Enter current password"
            disabled={saving}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">
            New Password
          </span>

          <Input
            type="password"
            value={passwords.newPassword}
            onChange={(event) =>
              setPasswords((current) => ({
                ...current,
                newPassword: event.target.value,
              }))
            }
            placeholder="Enter new password"
            disabled={saving}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-on-surface">
            Confirm New Password
          </span>

          <Input
            type="password"
            value={passwords.confirmPassword}
            onChange={(event) =>
              setPasswords((current) => ({
                ...current,
                confirmPassword: event.target.value,
              }))
            }
            placeholder="Confirm new password"
            disabled={saving}
          />
        </label>

        <div className="rounded-xl border border-outline/10 bg-surface-container-low p-4">
          <p className="text-sm font-semibold text-on-surface">
            Password Security
          </p>

          <p className="mt-1 text-sm text-on-surface-variant">
            Use a strong password that you don't use for other accounts.
          </p>
        </div>
      </div>

      {mfa && (
        <>
          <div className="border-t border-outline/10" />
          <div className="space-y-4 p-6">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">
                Two-Factor Authentication
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Add a second step at sign-in using an authenticator app.
              </p>
            </div>

            {mfaError && (
              <Alert
                variant="error"
                title="Could not load two-factor status"
                message={mfaError}
              />
            )}

            {recoveryCodes && (
              <MfaRecoveryCodes
                codes={recoveryCodes}
                onReveal={() => setRecoveryCodes(null)}
              />
            )}

            {mfaLoading ? (
              <p className="text-sm text-on-surface-variant">Loading…</p>
            ) : mfaMode === "enroll" ? (
              <MfaEnrollStep
                onEnroll={() => mfa.enroll()}
                onConfirm={handleConfirmEnroll}
              />
            ) : mfaMode === "disable" ? (
              <MfaVerifyStep
                onVerify={handleDisable}
                helperText="Enter a code from your authenticator app to turn off two-factor authentication."
                onUseAuthenticator={() => setMfaMode("idle")}
              />
            ) : mfaMode === "recovery" ? (
              <MfaVerifyStep
                onVerify={handleRegenerateRecoveryCodes}
                helperText="Enter a code from your authenticator app to replace your recovery codes."
                onUseAuthenticator={() => setMfaMode("idle")}
              />
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-outline/10 bg-surface-container-low p-4">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {totpEnabled
                      ? "Two-factor authentication is on"
                      : "Two-factor authentication is off"}
                  </p>
                  {totpEnabled && status && (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {status.recoveryCodesRemaining} recovery codes remaining
                    </p>
                  )}
                </div>
                {totpEnabled ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" type="button" onClick={() => setMfaMode("recovery")}>
                      Regenerate codes
                    </Button>
                    <Button variant="secondary" type="button" onClick={() => setMfaMode("disable")}>
                      Disable
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" type="button" onClick={handleStartEnroll}>
                    Set up
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </Card>
  );
}
