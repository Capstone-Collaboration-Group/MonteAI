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
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="font-semibold">
        {label}
      </label>

      <div className="relative">
        {icon && (
          <img
            src={icon}
            alt=""
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
          />
        )}

        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            h-12
            w-full
            rounded-lg
            border
            border-[#BDBDBD]
            ${icon ? "pl-12" : "px-4"}
            pr-4
            outline-none
            transition
            focus:border-[#006400]
            focus:ring-2
            focus:ring-[#006400]/20
          `}
        />
      </div>
    </div>
  );
}
