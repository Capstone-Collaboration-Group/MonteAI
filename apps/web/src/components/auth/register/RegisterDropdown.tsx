import { useEffect, useRef, useState } from "react";
import chevronDown from "../../../assets/auth/dropdown.svg";
import chevronUp from "../../../assets/auth/dropdown-up.svg";

export interface DropdownOption {
  label: string;
  value: string;
}

type RegisterDropdownProps = {
  label: string;
  placeholder: string;
  options: DropdownOption[];

  value: string;

  onChange: (value: string) => void;
};

export default function RegisterDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: RegisterDropdownProps) {
  const [open, setOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);

    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((item) => item.value === value)?.label || "";

  return (
    <div className="flex flex-col gap-2" ref={dropdownRef}>
      <label className="text-sm font-semibold text-[#1B1B1C]">{label}</label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="
          flex
          h-12
          items-center
          justify-between
          rounded-xl
          border
          border-[#D9D9D9]
          bg-white
          px-4
          transition-all
          duration-200
          hover:border-[#006400]
        "
      >
        <span className={`${value ? "text-[#1B1B1C]" : "text-gray-400"}`}>
          {value ? selected : placeholder}
        </span>

        <img
          src={open ? chevronUp : chevronDown}
          className="h-5 w-5 transition duration-200"
        />
      </button>

      <div
        className={`
          overflow-hidden
          transition-all
          duration-300
          ${open ? "max-h-72 opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="mt-2 rounded-xl border border-[#D9D9D9] bg-white shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="
                flex
                w-full
                px-4
                py-3
                text-left
                text-sm
                transition
                hover:bg-[#F3FFF3]
              "
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
