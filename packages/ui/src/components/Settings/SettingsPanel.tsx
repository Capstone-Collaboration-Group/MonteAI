import { useState } from "react";
import {
  Bell,
  CircleUserRound,
  Lock,
  Palette,
} from "lucide-react";

import type { UserService } from "@monteai/api";
import { PageHeader } from "../common";
import { AccountSettings } from "./AccountSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { NotificationSettings } from "./NotificationSettings";
import { SecuritySettings } from "./SecuritySettings";

type SettingsSection =
  "account" | "appearance" | "notifications" | "security";

interface SettingsPanelProps {
  userService: UserService;
}

const settingsItems: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof CircleUserRound;
}[] = [
  {
    id: "account",
    label: "Account",
    description: "Profile information",
    icon: CircleUserRound,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Display preferences",
    icon: Palette,
  },
  {
    id: "notifications",
    label: "Notification",
    description: "Manage notifications",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and security",
    icon: Lock,
  },
];

export function SettingsPanel({ userService }: SettingsPanelProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("account");

  const renderSettings = () => {
    switch (activeSection) {
      case "account":
        return <AccountSettings userService={userService} />;

      case "appearance":
        return <AppearanceSettings />;

      case "notifications":
        return <NotificationSettings />;

      case "security":
        return <SecuritySettings />;

      default:
        return <AccountSettings userService={userService} />;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="System preferences" title="Settings" />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Settings Navigation */}
        <aside className="h-fit rounded-2xl border border-outline/10 bg-surface-container-low p-2">
          <nav className="space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    isActive
                      ? "bg-primary-container/10 text-primary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />

                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>

                    <span className="mt-0.5 block truncate text-xs opacity-70">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Settings Panel */}
        <main className="min-w-0">{renderSettings()}</main>
      </div>
    </div>
  );
}
