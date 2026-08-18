import { useState } from "react";
import { Card } from "../Card";
import { Input } from "../Input";
import { Button } from "../Button";

export function ResearchSettings() {
  const [settings, setSettings] = useState({
    startYear: "2023",
    endYear: "Present",
    citationStyle: "APA 7th Edition",
    language: "English",
  });

  const handleSave = () => {
    console.log("Saving research settings:", settings);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-outline/10 px-6 py-5">
        <h2 className="text-lg font-semibold text-on-surface">
          Research Settings
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Customize how MONTESKOLAR searches and presents research.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">
            Research Year Range
          </h3>

          <p className="mt-1 text-sm text-on-surface-variant">
            Choose the publication period for research results.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-on-surface">
                From
              </span>

              <Input
                type="number"
                value={settings.startYear}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    startYear: event.target.value,
                  }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-on-surface">
                To
              </span>

              <Input
                value={settings.endYear}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    endYear: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-on-surface">
              Citation Style
            </span>

            <select
              value={settings.citationStyle}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  citationStyle: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option>APA 7th Edition</option>
              <option>MLA 9th Edition</option>
              <option>Chicago</option>
            </select>
          </label>
        </div>

        <div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-on-surface">
              Preferred Language
            </span>

            <select
              value={settings.language}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  language: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-outline/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option>English</option>
              <option>Filipino</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex justify-end border-t border-outline/10 px-6 py-4">
        <Button type="button" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}