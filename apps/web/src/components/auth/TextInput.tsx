type TextInputProps = {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function TextInput({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
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
        autoComplete="off"
        className="
          h-12
          w-full
          rounded-xl
          border
          border-[#D9D9D9]
          bg-white
          px-4
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
    </div>
  );
}
