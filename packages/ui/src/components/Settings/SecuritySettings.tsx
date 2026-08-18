import { useState } from "react";
import { Card } from "../Card";
import { Input } from "../Input";
import { Button } from "../Button";

export function SecuritySettings() {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSave = () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      console.error("Passwords do not match.");
      return;
    }

    console.log("Password update requested.");
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
        <Button type="button" onClick={handleSave}>
          Update Password
        </Button>
      </div>
    </Card>
  );
}