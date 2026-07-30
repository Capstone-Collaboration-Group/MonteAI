import { useState, useRef, type ReactNode, type ReactElement } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  arrow?: boolean;
  className?: string;
}

const positions = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2 animate-in fade-in zoom-in-95 duration-100",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2 animate-in fade-in zoom-in-95 duration-100",
  left: "right-full top-1/2 -translate-y-1/2 mr-2 animate-in fade-in zoom-in-95 duration-100",
  right: "left-full top-1/2 -translate-y-1/2 ml-2 animate-in fade-in zoom-in-95 duration-100",
};

const arrows = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-on-surface border-x-transparent border-b-transparent border-4",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-on-surface border-x-transparent border-t-transparent border-4",
  left: "left-full top-1/2 -translate-y-1/2 border-l-on-surface border-y-transparent border-r-transparent border-4",
  right: "right-full top-1/2 -translate-y-1/2 border-r-on-surface border-y-transparent border-l-transparent border-4",
};

export function Tooltip({ content, children, position = "top", delay = 150, arrow = true, className = "" }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => { timer.current = setTimeout(() => setShow(true), delay); };
  const stop = () => { if (timer.current) clearTimeout(timer.current); setShow(false); };

  return (
    <div className="relative inline-block" onMouseEnter={start} onMouseLeave={stop} onFocus={start} onBlur={stop}>
      {children}
      {show && content && (
        <div role="tooltip" className={`absolute z-50 px-2.5 py-1.5 text-xs font-medium bg-on-surface text-surface rounded-md shadow-lg whitespace-nowrap pointer-events-none ${positions[position]} ${className}`}>
          {content}
          {arrow && <div className={`absolute w-0 h-0 ${arrows[position]}`} />}
        </div>
      )}
    </div>
  );
}
