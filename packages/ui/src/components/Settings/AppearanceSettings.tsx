import { useState } from "react";
import { Card } from "../Card";
import { Button } from "../Button";

export function AppearanceSettings() {
  const [appearance, setAppearance] = useState({
    theme: "System",
    compactMode: false,
  });

  const handleSave = () => {
    console.log("Saving appearance:", appearance);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">
          Appearance
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Customize how MONTESKOLAR looks on your device.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <label className="space-y-2">
          <span className="text-sm font-medium text-on-surface">
            Theme
          </span>

          <select
            value={appearance.theme}
            onChange={(event) =>
              setAppearance((current) => ({
                ...current,
                theme: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface"
          >
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() =>
            setAppearance((current) => ({
              ...current,
              compactMode: !current.compactMode,
            }))
          }
          className="flex w-full items-center justify-between rounded-xl border border-outline/10 bg-surface-container-low p-4 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-on-surface">
              Compact Mode
            </p>

            <p className="mt-1 text-sm text-on-surface-variant">
              Reduce spacing between interface elements.
            </p>
          </div>

          <span
            className={`relative h-6 w-11 rounded-full ${
              appearance.compactMode
                ? "bg-[#0D7856]"
                : "bg-outline/40"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                appearance.compactMode ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}