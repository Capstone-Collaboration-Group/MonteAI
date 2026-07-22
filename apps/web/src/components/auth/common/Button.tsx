type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

export default function Button({
  children,
  type = "button",
  disabled = false,
  onClick,
}: ButtonProps) {

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="
        h-12
        w-full
        rounded-xl
        bg-[#006400]
        text-white
        font-semibold
        transition
        hover:bg-[#005400]
        disabled:cursor-not-allowed
        disabled:opacity-50
      "
    >
      {children}
    </button>
  );
}