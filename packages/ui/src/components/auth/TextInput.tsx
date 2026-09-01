type TextInputProps = {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function TextInput({
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
      <label htmlFor={name} className="text-sm font-semibold text-on-surface">
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
          border-outline-variant
          bg-white
          px-4
          text-base
          text-on-surface
          outline-none
          transition-all
          duration-200
          placeholder:text-outline
          focus:border-primary
          focus:ring-2
          focus:ring-primary/20
        "
      />
    </div>
  );
}
