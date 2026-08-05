import type { InputHTMLAttributes } from "react";

interface RatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}

export function RatingInput({
  label,
  value,
  max = 5,
  onChange,
  className = "",
  ...props
}: RatingInputProps) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${className}`}>
      <span className="font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        {Array.from({ length: max }, (_, index) => {
          const score = index + 1;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`h-9 w-9 rounded-full border text-sm font-semibold transition-colors ${score <= value ? "border-amber-500 bg-amber-100 text-amber-700" : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
            >
              {score}
            </button>
          );
        })}
      </div>
      <input
        type="range"
        min="1"
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
        {...props}
      />
    </label>
  );
}
