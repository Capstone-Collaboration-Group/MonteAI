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
    <header className="sticky top-0 z-50 w-full bg-surface-container-low/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5 lg:px-10">
        <Link
          to="/"
          className=" text-3xl font-black text-secondary transition hover:opacity-80"
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
                    ? "border-b-2 border-primary pb-1 text-sm font-bold text-primary"
                    : "text-sm font-bold text-on-surface-variant transition hover:text-primary"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="flex min-w-[100px] items-center justify-center rounded-full border border-primary bg-white px-5 py-3 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="flex min-w-[120px] items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
