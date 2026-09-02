import type { HTMLAttributes } from "react";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
}

const alertStyles = {
  info: "bg-sky-100 text-sky-900 border border-sky-200",
  success: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  warning: "bg-amber-100 text-amber-900 border border-amber-200",
  error: "bg-red-100 text-red-900 border border-red-200",
};

export function Alert({
  title,
  message,
  variant = "info",
  className = "",
  ...props
}: AlertProps) {
  return (
    <div
      className={`rounded-2xl p-4 text-sm shadow-sm ${alertStyles[variant]} ${className}`}
      {...props}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-slate-700">{message}</div>
    </div>
  );
}
