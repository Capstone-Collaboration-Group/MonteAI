import { useState, useRef, useEffect } from "react";
import type { SelectOption } from "./Select";

export interface ComboboxProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value: ctrlVal,
  onChange,
  placeholder = "Search...",
  label,
  error,
  disabled = false,
  className = "",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedVal, setSelectedVal] = useState(ctrlVal || "");
  const ref = useRef<HTMLDivElement>(null);

  const currentVal = ctrlVal ?? selectedVal;
  const selectedOption = options.find((o) => o.value === currentVal);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const clickOutside = (e: MouseEvent) =>
      ref.current &&
      !ref.current.contains(e.target as Node) &&
      setIsOpen(false);
    if (isOpen) document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [isOpen]);

  const selectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    if (ctrlVal === undefined) setSelectedVal(opt.value);
    onChange?.(opt.value);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`} ref={ref}>
      {label && (
        <label className="text-sm font-medium text-on-surface">{label}</label>
      )}
      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`w-full px-3.5 py-2.5 rounded-lg border text-sm flex items-center gap-2 bg-surface text-on-surface transition-colors focus-within:ring-2 ${
            error
              ? "border-status-critical focus-within:ring-status-critical/20"
              : "border-outline/30 focus-within:border-primary-container focus-within:ring-primary-container/20 dark:focus-within:border-status-approved"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <svg
            className="w-4 h-4 text-on-surface-variant shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {isOpen ? (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent outline-none text-on-surface text-sm"
            />
          ) : (
            <span
              className={`w-full truncate ${selectedOption ? "text-on-surface" : "text-on-surface-variant/60"}`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-on-surface-variant transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto py-1 bg-surface dark:bg-surface-container-low text-on-surface rounded-xl shadow-xl border border-outline/20 animate-in fade-in duration-100">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-center text-on-surface-variant">
                No results found
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => selectOption(opt)}
                  className={`w-full px-3.5 py-2 text-sm text-left flex items-center justify-between transition-colors cursor-pointer disabled:opacity-40 ${
                    opt.value === currentVal
                      ? "bg-primary-container/15 text-primary-container dark:text-status-approved font-medium"
                      : "hover:bg-surface-container-high text-on-surface"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === currentVal && (
                    <svg
                      className="w-4 h-4 text-primary-container dark:text-status-approved"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-status-critical dark:text-status-critical">
          {error}
        </p>
      )}
    </div>
  );
}
