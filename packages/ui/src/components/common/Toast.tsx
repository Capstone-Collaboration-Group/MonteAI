import { toast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
  type?: "success" | "error" | "info" | "warning";
  action?: { label: string; onClick: () => void };
}

export function showToast({
  title,
  description,
  type = "info",
  action,
}: ToastOptions) {
  const props = {
    description,
    action: action
      ? { label: action.label, onClick: action.onClick }
      : undefined,
  };
  if (type === "success") return toast.success(title, props);
  if (type === "error") return toast.error(title, props);
  return toast(title, props);
}

export type { ReactNode } from "react";
