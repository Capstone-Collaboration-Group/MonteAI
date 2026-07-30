import { useState } from "react";

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded" | "square";
  status?: "online" | "offline" | "busy" | "away";
  className?: string;
}

const sizes = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-12 h-12 text-lg", xl: "w-16 h-16 text-xl" };
const statusSizes = { xs: "w-1.5 h-1.5", sm: "w-2 h-2", md: "w-2.5 h-2.5 ring-2", lg: "w-3 h-3 ring-2", xl: "w-4 h-4 ring-2" };
const statusColors = { online: "bg-[#008000]", offline: "bg-outline", busy: "bg-[#FF0000]", away: "bg-[#FFFF00]" };
const shapes = { circle: "rounded-full", rounded: "rounded-lg", square: "rounded-none" };

const getInitials = (n?: string) => {
  if (!n) return "?";
  const p = n.trim().split(" ");
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

export function Avatar({ src, alt = "Avatar", name, size = "md", shape = "circle", status, className = "" }: AvatarProps) {
  const [err, setErr] = useState(false);
  return (
    <div className="relative inline-block select-none">
      <div className={`flex items-center justify-center font-medium bg-[#0D7856] text-white dark:bg-primary-container dark:text-on-primary-container overflow-hidden shrink-0 ${sizes[size]} ${shapes[shape]} ${className}`}>
        {src && !err ? <img src={src} alt={alt || name || "Avatar"} onError={() => setErr(true)} className="w-full h-full object-cover" /> : <span>{getInitials(name)}</span>}
      </div>
      {status && <span className={`absolute bottom-0 right-0 block rounded-full ring-surface dark:ring-surface-container ${statusSizes[size]} ${statusColors[status]}`} title={`Status: ${status}`} />}
    </div>
  );
}
