import type { ButtonHTMLAttributes } from "react";
import { Bell } from "lucide-react";

interface NotificationButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function NotificationButton({
  className = "",
  ...props
}: NotificationButtonProps) {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className={`p-2 rounded-full transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <Bell size={24} color="black" strokeWidth={2} />
    </button>
  );
}