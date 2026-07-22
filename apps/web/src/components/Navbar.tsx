import { Link, useLocation } from "react-router-dom";

type NavbarProps = {
  onLoginClick?: () => void;
};

export default function Navbar({ onLoginClick }: NavbarProps) {
  const location = useLocation();

  const navItems = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f1f1f1]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5 lg:px-10">
        <Link
          to="/"
          className="[font-family:'Inter-Black',Helvetica] text-2xl font-black text-[#006400] transition hover:opacity-80"
        >
          MonteSkolar
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-8 lg:gap-10">
          {navItems.map((item) => {
            const active = location.pathname === item.href;

            return (
              <Link
                key={item.label}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "border-b-2 border-[#006400] pb-1 text-sm font-bold text-[#006400]"
                    : "text-sm font-bold text-[#3f4a3a] transition hover:text-[#006400]"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLoginClick}
            className="flex min-w-[100px] items-center justify-center rounded-full border border-[#006400] bg-white px-5 py-3 text-sm font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#e8f6e8]"
          >
            Login
          </button>

          <button
            type="button"
            className="flex min-w-[120px] items-center justify-center rounded-full bg-[#006400] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a5c1a]"
          >
            Register
          </button>
        </div>
      </div>
    </header>
  );
}