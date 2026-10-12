// packages/ui/src/components/mfa/MfaCodeInput.tsx
import { useEffect, useRef, useState } from "react";

const CODE_LENGTH = 6;

type MfaCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called when all 6 digits are filled — for auto-submit. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  name?: string;
};

/**
 * 6-digit TOTP code entry. Renders six single-digit boxes, keeps a single
 * string as the source of truth, and handles paste (accepts "123 456",
 * "123456", etc.) and backspace-across-boxes.
 */
export function MfaCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  error = false,
  name = "mfa-code",
}: MfaCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const emit = (next: string) => {
    onChange(next);
    if (next.length === CODE_LENGTH && /^\d+$/.test(next)) {
      onComplete?.(next);
    }
  };

  const setDigit = (index: number, digit: string) => {
    const next = [...digits];
    next[index] = digit;
    emit(next.join("").slice(0, CODE_LENGTH));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) {
      setDigit(index, "");
      return;
    }
    setDigit(index, digit);
    if (index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        refs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    emit(pasted);
    const nextFocus = Math.min(pasted.length, CODE_LENGTH - 1);
    refs.current[nextFocus]?.focus();
  };

  const baseClasses =
    "h-14 w-12 rounded-xl border bg-white text-center text-2xl font-semibold text-on-surface outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";
  const borderClasses = error
    ? "border-error focus:border-error focus:ring-error/20"
    : "border-outline-variant";

  return (
    <div className="flex w-full justify-between gap-2" role="group" aria-label="6-digit code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { refs.current[index] = el; }}
          id={`${name}-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          onFocus={() => setFocusedIndex(index)}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`${baseClasses} ${borderClasses} ${
            focusedIndex === index && digit ? "scale-105" : ""
          }`}
        />
      ))}
    </div>
  );
}
