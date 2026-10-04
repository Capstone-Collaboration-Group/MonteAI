import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-surface-container-low/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-8 sm:py-5 lg:px-10">
        <Link
          to="/"
          className="text-2xl font-black text-primary transition hover:opacity-80 sm:text-3xl"
        >
          MonteSkolar
        </Link>

        <nav
          aria-label="Primary"
          className="order-3 flex w-full items-center justify-center gap-8 sm:order-2 sm:w-auto lg:gap-10"
        >
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

        <div className="order-2 flex items-center gap-2 sm:order-3 sm:gap-3">
          <Link
            to="/login"
            className="flex min-w-[68px] items-center justify-center rounded-full border border-primary bg-surface px-3 py-2 text-xs font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low sm:min-w-[100px] sm:px-5 sm:py-3 sm:text-sm"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="flex min-w-[78px] items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-semibold text-on-primary shadow-sm transition hover:bg-primary-container sm:min-w-[120px] sm:px-5 sm:py-3 sm:text-sm"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
