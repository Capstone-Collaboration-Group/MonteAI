import { useState } from "react";
import eyeOpen from "../../assets/eye-open.svg";
import eyeClosed from "../../assets/eye-closed.svg";

type PasswordInputProps = {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function PasswordInput({
  label,
  name,
  placeholder,
  value,
  onChange,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Label */}
      <label htmlFor={name} className="text-sm font-semibold text-[#1B1B1C]">
        {label}
      </label>

      {/* Input Wrapper */}
      <div className="relative">
        <input
          id={name}
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="
            h-12
            w-full
            rounded-xl
            border
            border-[#D9D9D9]
            bg-white
            px-4
            pr-12
            text-base
            text-[#1B1B1C]
            outline-none
            transition-all
            duration-200
            placeholder:text-[#9CA3AF]
            focus:border-[#006400]
            focus:ring-2
            focus:ring-[#006400]/20
          "
        />

        {/* Eye Button */}
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          onClick={() => setShowPassword((prev) => !prev)}
          className="
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            rounded-md
            p-1
            transition
            duration-200
            hover:bg-gray-100
          "
        >
          <img
            src={showPassword ? eyeClosed : eyeOpen}
            alt={showPassword ? "Hide password" : "Show password"}
            className="h-5 w-5"
          />
        </button>
      </div>
    </div>
  );
}
