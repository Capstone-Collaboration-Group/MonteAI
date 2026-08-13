// packages/ui/src/components/Thesis/VersionSelector.tsx
import { History } from "lucide-react";
import type { ThesisVersion } from "@monteai/types";
import { Dropdown } from "../common/Dropdown";

interface VersionSelectorProps {
  versions: ThesisVersion[];
  activeVersion: ThesisVersion | null;
  onVersionChange: (versionId: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function VersionSelector({
  versions,
  activeVersion,
  onVersionChange,
}: VersionSelectorProps) {
  if (versions.length === 0) return null;

  return (
    <Dropdown
      placement="bottom-right"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-[#EDEAE0] bg-white px-3 py-2 text-sm font-medium text-[#4A5750] transition-colors hover:bg-[#F3F1E9] hover:text-[#16342B]"
        >
          <History className="h-4 w-4 text-[#8A9089]" />
          {activeVersion
            ? `Version ${activeVersion.versionNumber}`
            : "Select version"}
        </button>
      }
    >
      {versions.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onVersionChange(v.id)}
          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#F3F1E9] ${
            activeVersion?.id === v.id
              ? "font-semibold text-[#16342B]"
              : "text-[#4A5750]"
          }`}
        >
          <span className="block font-medium">Version {v.versionNumber}</span>
          <span className="block text-xs text-[#8A9089]">
            {formatDate(v.uploadedAt)}
            {v.changeNote ? ` · ${v.changeNote}` : ""}
          </span>
        </button>
      ))}
    </Dropdown>
  );
}