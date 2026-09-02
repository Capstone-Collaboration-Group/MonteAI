import { useState, useRef, useEffect, type ReactNode } from "react";

export interface SelectOption { label: string; value: string; disabled?: boolean; icon?: ReactNode; }
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({ options, value: ctrlVal, defaultValue = "", onChange, placeholder = "Select...", label, error, disabled = false, className = "" }: SelectProps) {
  const [internalVal, setInternalVal] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentVal = ctrlVal ?? internalVal;
  const selectedOption = options.find((o) => o.value === currentVal);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setIsOpen(false);
    if (isOpen) document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [isOpen]);

  const selectOption = (opt: SelectOption) => {
    if (opt.disabled) return;
    if (ctrlVal === undefined) setInternalVal(opt.value);
    onChange?.(opt.value);
    setIsOpen(false);
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`} ref={ref}>
      {label && <label className="text-sm font-medium text-on-surface">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-left flex items-center justify-between transition-colors bg-surface text-on-surface focus:outline-none focus:ring-2 disabled:opacity-50 cursor-pointer ${
            error ? "border-error focus:ring-error/20" : "border-outline/30 focus:border-primary focus:ring-primary/20"
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedOption?.icon}
            <span className={selectedOption ? "text-on-surface" : "text-on-surface-variant/60"}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </span>
          <svg className={`w-4 h-4 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto py-1 bg-surface dark:bg-surface-container-low text-on-surface rounded-xl shadow-xl border border-outline/20 animate-in fade-in duration-100">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => selectOption(opt)}
                className={`w-full px-3.5 py-2 text-sm text-left flex items-center justify-between transition-colors cursor-pointer disabled:opacity-40 ${
                  opt.value === currentVal 
                    ? "bg-primary/15 text-primary font-medium" 
                    : "hover:bg-surface-container-high text-on-surface"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon}
                  <span>{opt.label}</span>
                </span>
                {opt.value === currentVal && (
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}