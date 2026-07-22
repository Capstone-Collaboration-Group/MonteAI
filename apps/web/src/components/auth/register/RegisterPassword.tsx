import { useState } from "react";

import eyeOpen from "../../../assets/eye-open.svg";
import eyeClosed from "../../../assets/eye-closed.svg";

type RegisterPasswordProps = {
  label: string;
  name: string;
  placeholder: string;
  value: string;

  compareWith?: string;

  error?: string;

  disabled?: boolean;

  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function RegisterPassword({
  label,
  name,
  placeholder,
  value,
  compareWith,
  error,
  disabled = false,
  onChange,
}: RegisterPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {/* Label */}
      <label htmlFor={name} className="text-sm font-semibold text-[#111111]">
        {label}
      </label>

      {/* Input */}
      <div className="relative">
        <input
          id={name}
          name={name}
          disabled={disabled}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          className={`
            h-11
            w-full
            rounded-[10px]
            border
            bg-white
            px-3.5
            pr-11
            text-sm
            text-[#111111]
            placeholder:text-[#9CA3AF]
            outline-none
            transition-all
            duration-200
            ${
              error
                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-[#D9D9D9] focus:border-[#006400] focus:ring-2 focus:ring-[#006400]/15"
            }
            disabled:bg-gray-50
            disabled:cursor-not-allowed
            disabled:opacity-60
          `}
        />

        {/* Eye Button */}
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((prev) => !prev)}
          className="
            absolute
            right-2.5
            top-1/2
            -translate-y-1/2
            flex
            items-center
            justify-center
            rounded-md
            p-1.5
            transition
            duration-200
            hover:bg-gray-100
            active:scale-95
            cursor-pointer
          "
        >
          <img
            src={showPassword ? eyeClosed : eyeOpen}
            alt={showPassword ? "Hide password" : "Show password"}
            className="h-4 w-4"
          />
        </button>
      </div>

      {/* Error */}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
