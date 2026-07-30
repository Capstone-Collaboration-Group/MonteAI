import { useState, useRef, useEffect, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
  autoResize?: boolean;
  className?: string;
}

export function Textarea({ label, error, helperText, showCount = false, autoResize = false, className = "", value, defaultValue, maxLength, onChange, disabled, rows = 3, ...props }: TextareaProps) {
  const [val, setVal] = useState(value ?? defaultValue ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const currentLen = String(value !== undefined ? value : val).length;

  useEffect(() => {
    if (autoResize && ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value, val, autoResize]);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-on-surface flex items-center justify-between">
          <span>{label}</span>
          {showCount && maxLength && <span className="text-xs text-on-surface-variant">{currentLen}/{maxLength}</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          if (value === undefined) setVal(e.target.value);
          onChange?.(e);
        }}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 bg-surface text-on-surface placeholder:text-on-surface-variant/50 disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? "border-[#FF0000] focus:ring-[#FF0000]/20" : "border-outline/30 focus:border-[#0D7856] focus:ring-[#0D7856]/20 dark:focus:border-[#5CC29A]"
        } ${className}`}
        {...props}
      />
      {error ? <p className="text-xs text-[#FF0000] dark:text-[#FF6B6B]">{error}</p> : helperText ? <p className="text-xs text-on-surface-variant">{helperText}</p> : null}
    </div>
  );
}
