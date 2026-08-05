import type { HTMLAttributes } from "react";

interface NotificationProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  message?: string;
  variant?: "success" | "error" | "info" | "warning";
}

const notificationStyles = {
  success: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  error: "bg-red-100 text-red-900 border border-red-200",
  info: "bg-sky-100 text-sky-900 border border-sky-200",
  warning: "bg-amber-100 text-amber-900 border border-amber-200",
};

export function Notification({
  title,
  message,
  variant = "info",
  className = "",
  ...props
}: NotificationProps) {
  return (
    <div
      className={`rounded-2xl p-4 text-sm shadow-sm ${notificationStyles[variant]} ${className}`}
      {...props}
    >
      <div className="font-semibold">{title}</div>
      {message && <div className="mt-1 text-slate-700">{message}</div>}
    </div>
  );
}
