type TextInputProps = {
  disabled?: boolean;
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // NEW
  error?: string;
};

export default function TextInput({
  disabled,
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
}: TextInputProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      {/* Label */}
      <label htmlFor={name} className="text-sm font-semibold text-[#1B1B1C]">
        {label}
      </label>

      {/* Input */}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete="off"
        className={`
          h-12
          w-full
          rounded-xl
          border
          bg-white
          px-4
          text-base
          text-[#1B1B1C]
          outline-none
          transition-all
          duration-200
          placeholder:text-[#9CA3AF]
          focus:ring-2
          disabled:bg-gray-100
          disabled:cursor-not-allowed
          disabled:opacity-70
          ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : "border-[#D9D9D9] focus:border-[#006400] focus:ring-[#006400]/20"
          }
        `}
      />

      {/* Error Message */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
