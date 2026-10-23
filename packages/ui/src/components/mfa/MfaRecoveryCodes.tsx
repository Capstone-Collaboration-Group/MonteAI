// packages/ui/src/components/mfa/MfaRecoveryCodes.tsx
import { useState } from "react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Alert } from "../common/Alert";
import { showToast } from "../common/Toast";

type MfaRecoveryCodesProps = {
  codes: string[];
  /** Hides the list and shows a confirmation prompt — e.g. in the settings page after setup. */
  compact?: boolean;
  /** Shown when `compact` — lets the user re-open the full list once. */
  onReveal?: () => void;
  /** Optional regenerate action — requires a valid TOTP code first. */
  onRegenerate?: () => Promise<void>;
};

/**
 * Displays the one-time recovery codes returned by enroll/confirm or
 * recovery-codes/regenerate. These are shown exactly once and never
 * retrievable again — the UI makes that explicit and offers a download.
 */
export function MfaRecoveryCodes({
  codes,
  compact = false,
  onReveal,
  onRegenerate,
}: MfaRecoveryCodesProps) {
  const [revealed, setRevealed] = useState(!compact);
  const [regenerating, setRegenerating] = useState(false);

  const download = () => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "monteai-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      showToast({ title: "Copied", description: "Recovery codes copied to clipboard.", type: "success" });
    } catch {
      showToast({ title: "Copy failed", description: "Select and copy the codes manually.", type: "error" });
    }
  };

  const regenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not regenerate codes.";
      showToast({ title: "Regenerate failed", description: message, type: "error" });
    } finally {
      setRegenerating(false);
    }
  };

  if (!revealed) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-on-surface-variant">
          You have {codes.length} unused recovery codes. Keep them somewhere safe — each works once if you lose access to your authenticator app.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setRevealed(true)}>
            Reveal codes
          </Button>
          {onRegenerate && (
            <Button variant="ghost" onClick={() => void regenerate()} disabled={regenerating}>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <Alert
        variant="warning"
        title="Save these codes now"
        message="Each recovery code works once. They will not be shown again — download or copy them before you leave this page."
      />

      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Recovery codes">
        {codes.map((code, i) => (
          <li
            key={`${code}-${i}`}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-sm text-on-surface"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={download}>
          Download
        </Button>
        <Button variant="secondary" onClick={() => void copy()}>
          Copy all
        </Button>
        {onReveal && (
          <Button variant="ghost" onClick={onReveal}>
            Hide
          </Button>
        )}
        {onRegenerate && (
          <Button variant="ghost" onClick={() => void regenerate()} disabled={regenerating}>
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        )}
      </div>
    </Card>
  );
}
