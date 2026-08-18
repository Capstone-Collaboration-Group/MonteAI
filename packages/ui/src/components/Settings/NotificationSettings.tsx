import { useState } from "react";
import { Card } from "../Card";
import { Button } from "../Button";

export function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    researchUpdates: true,
    thesisUpdates: true,
    systemAnnouncements: true,
    emailNotifications: false,
  });

  const handleSave = () => {
    console.log("Saving notification settings:", notifications);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">
          Notifications
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Choose which notifications you want to receive.
        </p>
      </div>

      <div className="space-y-3 p-6">
        <NotificationToggle
          label="Research Updates"
          description="Receive updates related to your research."
          checked={notifications.researchUpdates}
          onChange={(value) =>
            setNotifications((current) => ({
              ...current,
              researchUpdates: value,
            }))
          }
        />

        <NotificationToggle
          label="Thesis Updates"
          description="Receive updates about thesis submissions and reviews."
          checked={notifications.thesisUpdates}
          onChange={(value) =>
            setNotifications((current) => ({
              ...current,
              thesisUpdates: value,
            }))
          }
        />

        <NotificationToggle
          label="System Announcements"
          description="Receive important announcements from MONTESKOLAR."
          checked={notifications.systemAnnouncements}
          onChange={(value) =>
            setNotifications((current) => ({
              ...current,
              systemAnnouncements: value,
            }))
          }
        />

        <NotificationToggle
          label="Email Notifications"
          description="Receive selected notifications through email."
          checked={notifications.emailNotifications}
          onChange={(value) =>
            setNotifications((current) => ({
              ...current,
              emailNotifications: value,
            }))
          }
        />
      </div>

      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-outline/10 bg-surface-container-low p-4 text-left"
    >
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>

        <p className="mt-1 text-sm text-on-surface-variant">
          {description}
        </p>
      </div>

      <span
        className={`relative h-6 w-11 rounded-full ${
          checked ? "bg-[#0D7856]" : "bg-outline/40"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}