import { useEffect, useState } from "react";

import type { UserService } from "@monteai/api";
import type { UserProfileDto } from "@monteai/types";

import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Avatar, showToast } from "../common";

interface AccountSettingsProps {
  userService: UserService;
}

export function AccountSettings({ userService }: AccountSettingsProps) {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [institute, setInstitute] = useState("");

  const isStudent = profile?.role === "Student";
  const showInstitute = profile != null && profile.role !== "Admin";

  useEffect(() => {
    let active = true;
    userService
      .getMe()
      .then((me) => {
        if (!active || !me) return;
        setProfile(me);
        setFirstName(me.firstName ?? "");
        setMiddleInitial(me.middleInitial ?? "");
        setLastName(me.lastName ?? "");
        setStudentNo(me.studentNumber ?? "");
        setInstitute(me.institute ?? "");
      })
      .catch(() => {
        // stays null — Save stays disabled
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userService]);

  const handleSave = async () => {
    if (!profile || saving) return;

    if (!firstName.trim() || !lastName.trim()) {
      showToast({
        title: "Missing name",
        description: "First name and last name are required.",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await userService.updateMe({
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim(),
        lastName: lastName.trim(),
        ...(isStudent ? { studentNumber: studentNo.trim() } : {}),
        ...(showInstitute && institute ? { institute } : {}),
      });

      if (!updated) {
        showToast({
          title: "Update failed",
          description: "Your profile could not be updated. Please try again.",
          type: "error",
        });
        return;
      }

      setProfile(updated);
      showToast({
        title: "Profile updated",
        description: "Your changes have been saved.",
        type: "success",
      });
    } catch {
      showToast({
        title: "Update failed",
        description: "Your profile could not be updated. Please try again.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      {/* Profile Information Header */}
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-base font-semibold text-on-surface">
          Profile Information
        </h2>
      </div>

      {/* Profile Content */}
      <div className="p-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_180px]">
          {/* Account Information */}
          <div className="space-y-5">
            {/* First Name */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                First Name
              </span>

              <Input
                value={firstName}
                placeholder="Enter your first name"
                onChange={(event) => setFirstName(event.target.value)}
                disabled={loading}
              />
            </label>

            {/* Middle Initial */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                Middle Initial
              </span>

              <Input
                value={middleInitial}
                placeholder="e.g. B"
                maxLength={1}
                onChange={(event) =>
                  setMiddleInitial(event.target.value.slice(0, 1))
                }
                disabled={loading}
              />
            </label>

            {/* Last Name */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                Last Name
              </span>

              <Input
                value={lastName}
                placeholder="Enter your last name"
                onChange={(event) => setLastName(event.target.value)}
                disabled={loading}
              />
            </label>

            {/* Email (read-only: must stay in sync with the sign-in email) */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">Email</span>

              <Input
                type="email"
                value={profile?.email ?? ""}
                placeholder="Enter your email"
                onChange={() => undefined}
                disabled
              />

              <span className="block text-xs text-on-surface-variant">
                Contact the ICT office to change your email.
              </span>
            </label>

            {/* Student Number (students only) */}
            {isStudent && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-on-surface">
                  Student No.
                </span>

                <Input
                  value={studentNo}
                  placeholder="Enter your student number"
                  onChange={(event) => setStudentNo(event.target.value)}
                  disabled={loading}
                />
              </label>
            )}

            {/* Institute */}
            {showInstitute && (
              <div className="space-y-2">
                <label
                  htmlFor="institute"
                  className="block text-sm font-medium text-on-surface"
                >
                  Institute
                </label>

                <select
                  id="institute"
                  value={institute}
                  onChange={(event) => setInstitute(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
                >
                  <option value="" disabled>
                    Select your Institute
                  </option>

                  <option value="ICS">ICS</option>
                  <option value="ITE">ITE</option>
                  <option value="IBE">IBE</option>
                </select>
              </div>
            )}
          </div>

          {/* Profile Picture — initial letter of the first name */}
          <div className="flex w-full flex-col items-center gap-4 md:w-44 md:shrink-0">
            <span className="text-sm font-medium text-on-surface">
              Profile Picture
            </span>

            <Avatar
              name={firstName || profile?.firstName || "User"}
              size="xl"
              className="h-24 w-24 text-2xl ring-4 ring-primary-container/15"
            />
          </div>
        </div>
      </div>

      {/* Save Changes */}
      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !profile}
        >
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </Card>
  );
}
