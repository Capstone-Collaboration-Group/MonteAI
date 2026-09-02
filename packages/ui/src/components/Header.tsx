import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

interface HeaderProps {
  onNewAnnouncement?: () => void;
}

export function Header({ onNewAnnouncement }: HeaderProps) {
  const [search, setSearch] = useState("");

  function handleNewAnnouncement() {
    onNewAnnouncement?.();
  }

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">Announcements management</p>
        <h2 className="text-2xl font-semibold text-on-surface">Overview</h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by subject, category, or author"
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            className="rounded-full border-outline-variant bg-surface-container-low"
          />
        </div>
        <Button variant="secondary" className="rounded-full" onClick={handleNewAnnouncement}>
          + New announcement
        </Button>
      </div>
    </header>
  );
}