type HamburgerProps = {
  open?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Hamburger({
  open = false,
  onClick,
  className = "",
}: HamburgerProps) {
  return (
    <button
      type="button"
      aria-label="Toggle menu"
      aria-expanded={open}
      onClick={onClick}
      className={`flex h-10 w-10 flex-col items-center justify-center gap-1 ${className}`}
    >
      <span
        className={`h-0.5 w-6 rounded bg-current transition-all duration-300 ${
          open ? "translate-y-1.5 rotate-45" : ""
        }`}
      />

      <span
        className={`h-0.5 w-6 rounded bg-current transition-all duration-300 ${
          open ? "opacity-0" : ""
        }`}
      />

      <span
        className={`h-0.5 w-6 rounded bg-current transition-all duration-300 ${
          open ? "-translate-y-1.5 -rotate-45" : ""
        }`}
      />
    </button>
  );
}