import { useState } from "react";
import { UserCircle } from "lucide-react";

import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Avatar } from "../common";

interface Profile {
  name: string;
  email: string;
  studentNo: string;
  Institute: string;
}

export function AccountSettings() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    studentNo: "",
    Institute: "",
  });

  const handleChange =
    (field: keyof Profile) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setProfile((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleSave = () => {
    // TODO: Connect this to Firebase/backend
    // when profile saving is implemented.
    console.log("Profile saved:", profile);
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
            {/* Full Name */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                Full Name
              </span>

              <Input
                value={profile.name}
                placeholder="Enter your full name"
                onChange={handleChange("name")}
              />
            </label>

            {/* Email */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                Email
              </span>

              <Input
                type="email"
                value={profile.email}
                placeholder="Enter your email"
                onChange={handleChange("email")}
              />
            </label>

            {/* Student Number */}
            <label className="block space-y-2">
              <span className="text-sm font-medium text-on-surface">
                Student No.
              </span>

              <Input
                value={profile.studentNo}
                placeholder="Enter your student number"
                onChange={handleChange("studentNo")}
              />
            </label>

            {/* Institute */}
            <div className="space-y-2">
  <label
    htmlFor="institute"
    className="block text-sm font-medium text-on-surface"
  >
    Institute
  </label>

  <select
    id="institute"
    value={profile.Institute}
    onChange={(event) =>
      setProfile((current) => ({
        ...current,
        Institute: event.target.value,
      }))
    }
    className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-[#0D7856] focus:ring-2 focus:ring-[#0D7856]/20"
  >
    <option value="" disabled>
      Select your Institute
    </option>

    <option value="ICS">ICS</option>
    <option value="ITE">ITE</option>
    <option value="IBE">IBE</option>
  </select>
</div>
          </div>

          {/* Profile Picture */}
          <div className="flex w-full flex-col items-center gap-4 md:w-44 md:shrink-0">
            <span className="text-sm font-medium text-on-surface">
                Profile Picture
            </span>
            
            <Avatar
            name={profile.name || "User"}
            size="xl"
            className="h-24 w-24 text-2xl ring-4 ring-[#0D7856]/15"
              />
              
              <Button
              type="button"
              variant="primary"
              className="w-full max-w-[140px]"
            >
                Change Photo
            </Button>
            </div>
        </div>
      </div>

      {/* Save Changes */}
      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}