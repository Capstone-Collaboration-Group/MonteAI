import { useState } from "react";
import { Card } from "../Card";
import { Button } from "../Button";

export function AIPreferences() {
  const [preferences, setPreferences] = useState({
    responseStyle: "Academic",
    responseLength: "Detailed",
    includeSources: true,
    useContext: true,
  });

  const handleSave = () => {
    console.log("Saving AI preferences:", preferences);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">
          AI Preferences
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Customize how MONTESKOLAR responds to your research questions.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <label className="space-y-2">
          <span className="text-sm font-medium text-on-surface">
            Response Style
          </span>

          <select
            value={preferences.responseStyle}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                responseStyle: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface"
          >
            <option>Academic</option>
            <option>Simple</option>
            <option>Professional</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-on-surface">
            Response Length
          </span>

          <select
            value={preferences.responseLength}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                responseLength: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface"
          >
            <option>Concise</option>
            <option>Moderate</option>
            <option>Detailed</option>
          </select>
        </label>

        <Toggle
          label="Include Sources"
          description="Show supporting sources with AI responses."
          checked={preferences.includeSources}
          onChange={(checked) =>
            setPreferences((current) => ({
              ...current,
              includeSources: checked,
            }))
          }
        />

        <Toggle
          label="Use Research Context"
          description="Allow the AI to use your selected research context."
          checked={preferences.useContext}
          onChange={(checked) =>
            setPreferences((current) => ({
              ...current,
              useContext: checked,
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

function Toggle({
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