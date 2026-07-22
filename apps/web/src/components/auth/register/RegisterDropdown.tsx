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
    <div className="relative flex flex-col gap-1.5" ref={dropdownRef}>
      <label className="text-sm font-semibold text-[#111111]">{label}</label>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="
          flex
          h-11
          w-full
          items-center
          justify-between
          rounded-[10px]
          border
          border-[#D9D9D9]
          bg-white
          px-3.5
          transition-all
          duration-200
          hover:border-[#006400]/50
          focus:border-[#006400]
          focus:ring-2
          focus:ring-[#006400]/15
          outline-none
        "
      >
        <span
          className={`truncate text-sm ${value ? "text-[#111111]" : "text-[#9CA3AF]"}`}
        >
          {value ? selected : placeholder}
        </span>

        <img
          src={open ? chevronUp : chevronDown}
          className="h-4 w-4 transition-transform duration-200"
        />
      </button>

      {/* Dropdown menu — absolute positioned with smooth drop animation */}
      <div
        className={`
          absolute
          left-0
          right-0
          top-full
          z-20
          mt-1.5
          transition-all
          duration-300
          ease-in-out
          origin-top
          ${open ? "scale-y-100 opacity-100" : "scale-y-90 opacity-0 pointer-events-none"}
        `}
      >
        <div className="rounded-[10px] border border-[#D9D9D9] bg-white shadow-lg shadow-black/5">
          {options.length === 0 ? (
            <div className="px-3.5 py-3 text-sm text-[#9CA3AF]">
              No options available
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`
                    flex
                    w-full
                    px-3.5
                    py-2.5
                    text-left
                    text-sm
                    transition
                    hover:bg-[#F0FFF0]
                    ${value === option.value ? "bg-[#F0FFF0] text-[#006400] font-semibold" : "text-[#111111]"}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
