import { useState } from "react";
import {
  Avatar,
  Badge,
  PageHeader,
  TabContent,
  TabList,
  TabTrigger,
  Tabs,
} from "../common";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${checked ? "border-[#0D7856]/30 bg-[#0D7856]/10" : "border-outline/20 bg-surface-container-low"}`}
    >
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#0D7856]" : "bg-outline/50"}`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}

export function SettingsPanel() {
  const [profile, setProfile] = useState({
    name: "Dr. Elaine Cruz",
    email: "elaine.cruz@cdm.edu.ph",
    role: "Research Coordinator",
  });
  const [darkMode, setDarkMode] = useState(true);
  const [compactView, setCompactView] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="System preferences"
        title="Settings"
        actions={
          <Badge variant="primary" size="md">
            Live updates
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-outline/10 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  name={profile.name}
                  size="lg"
                  className="ring-4 ring-[#0D7856]/10"
                />
                <div>
                  <p className="text-lg font-semibold text-on-surface">
                    {profile.name}
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {profile.role}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Reset</Button>
                <Button>Save</Button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="account" variant="pills" className="gap-5">
              <TabList className="justify-start">
                <TabTrigger value="account">Account</TabTrigger>
                <TabTrigger value="preferences">Preferences</TabTrigger>
                <TabTrigger value="notifications">Notifications</TabTrigger>
              </TabList>

              <TabContent value="account" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-on-surface">
                    <span>Full name</span>
                    <Input
                      value={profile.name}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-on-surface">
                    <span>Email</span>
                    <Input
                      value={profile.email}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm font-medium text-on-surface">
                  <span>Role</span>
                  <Input
                    value={profile.role}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="rounded-xl border border-outline/10 bg-surface-container-low p-4">
                  <p className="text-sm font-semibold text-on-surface">
                    Security snapshot
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Two-factor authentication is enabled for this account.
                  </p>
                </div>
              </TabContent>

              <TabContent value="preferences" className="space-y-4">
                <ToggleRow
                  label="Dark mode"
                  description="Use the darker palette for longer reading sessions."
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
                <ToggleRow
                  label="Compact layout"
                  description="Reduce spacing to fit more content on screen."
                  checked={compactView}
                  onCheckedChange={setCompactView}
                />
              </TabContent>

              <TabContent value="notifications" className="space-y-4">
                <ToggleRow
                  label="System notifications"
                  description="Receive alerts for submissions and important updates."
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
                <ToggleRow
                  label="Email digest"
                  description="Get a summary of activity by email each morning."
                  checked={emailDigest}
                  onCheckedChange={setEmailDigest}
                />
              </TabContent>
            </Tabs>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Sync status
                </p>
                <p className="text-sm text-on-surface-variant">
                  Everything is up to date.
                </p>
              </div>
              <Badge variant="defense" size="sm">
                Synced
              </Badge>
            </div>
            <div className="rounded-xl bg-surface-container-high/60 p-3 text-sm text-on-surface-variant">
              <p>Last backup: 2 minutes ago</p>
              <p className="mt-1">Connected devices: 2</p>
            </div>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-on-surface">Quick tips</p>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>• Update your role if your responsibilities change.</li>
              <li>
                • Enable email digest to stay informed without checking
                constantly.
              </li>
              <li>• Use compact view when working across multiple panels.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
