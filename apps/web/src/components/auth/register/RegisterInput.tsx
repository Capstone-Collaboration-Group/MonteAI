import type { ChangeEvent } from "react";

type RegisterInputProps = {
  label: string;
  name: string;
  placeholder: string;

  value: string;

  onChange: (e: ChangeEvent<HTMLInputElement>) => void;

  type?: string;

  icon?: string;

  disabled?: boolean;
};

export default function RegisterInput({
  label,
  name,
  placeholder,
  icon,
  value,
  onChange,
  type = "text",
  disabled = false,
}: RegisterInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-[#111111]">
        {label}
      </label>

      <div className="relative">
        {icon && (
          <img
            src={icon}
            alt=""
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          />
        )}

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            h-11
            w-full
            rounded-[10px]
            border
            border-[#D9D9D9]
            bg-white
            ${icon ? "pl-10" : "px-3.5"}
            pr-3.5
            text-sm
            text-[#111111]
            placeholder:text-[#9CA3AF]
            outline-none
            transition-all
            duration-200
            focus:border-[#006400]
            focus:ring-2
            focus:ring-[#006400]/15
            disabled:bg-gray-50
            disabled:cursor-not-allowed
            disabled:opacity-60
          `}
        />
      </div>
    </div>
  );
}
