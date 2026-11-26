import type { ReactNode } from "react";

type AgreementNoticeProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  label: ReactNode;
  ariaLabel: string;
  onRequestAccept?: () => void;
};

export function AgreementNotice({
  accepted,
  onAcceptedChange,
  label,
  ariaLabel,
  onRequestAccept,
}: AgreementNoticeProps) {
  return (
    <section className="flex w-full items-center justify-center gap-2 py-1 text-on-surface">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(event) => {
          if (event.target.checked) {
            if (accepted) onAcceptedChange(true);
            else onRequestAccept?.();
          } else {
            onAcceptedChange(false);
          }
        }}
        required
        aria-label={ariaLabel}
        className="h-4 w-4 shrink-0 accent-primary"
      />
      <div className="min-w-0 text-left text-sm leading-5">{label}</div>
    </section>
  );
}
