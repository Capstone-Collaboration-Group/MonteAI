import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useAuth } from "@monteai/hooks";

import { Card } from "../Card";
import { Input } from "../Input";
import { Button } from "../Button";
import { showToast } from "../common";

export function SecuritySettings() {
  const { user } = useAuth();
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

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

      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </Card>
  );
}
