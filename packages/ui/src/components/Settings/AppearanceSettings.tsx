import { useState } from "react";

import { Card } from "../Card";

const COMPACT_MODE_STORAGE_KEY = "monteai.settings.compactMode";

function readCompactMode(): boolean {
  try {
    return localStorage.getItem(COMPACT_MODE_STORAGE_KEY) === "true";
  } catch {
    // storage unavailable (private mode) — keep default
    return false;
  }
}

export function AppearanceSettings() {
  const [compactMode, setCompactMode] = useState(readCompactMode);

  const toggleCompactMode = () => {
    setCompactMode((current) => {
      const next = !current;
      try {
        localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(next));
      } catch {
        // preference is best-effort
      }
      return next;
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">Appearance</h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Customize how MONTESKOLAR looks on your device.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <button
          type="button"
          onClick={toggleCompactMode}
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
              compactMode ? "bg-primary-container" : "bg-outline/40"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                compactMode ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </div>
    </Card>
  );
}
