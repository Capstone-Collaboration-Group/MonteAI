const navItems = [
  { label: "Home", active: true, href: "/" },
  { label: "About Us", active: false, href: "#about" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#f1f1f1]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5 lg:px-10">
        <a
          href="/"
          className="[font-family:'Inter-Black',Helvetica] text-2xl font-black text-[#006400] transition hover:opacity-80"
        >
          MonteSkolar
        </a>

        <nav aria-label="Primary" className="flex items-center gap-8 lg:gap-10">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={
                item.active
                  ? "border-b-2 border-[#006400] pb-1 [font-family:'Inter-Bold',Helvetica] text-sm font-bold text-[#006400]"
                  : "[font-family:'Inter-Bold',Helvetica] text-sm font-bold text-[#3f4a3a] transition hover:text-[#006400]"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-full border border-[#006400] bg-white px-5 py-3 text-sm font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#e8f6e8] hover:text-[#004000] hover:shadow-md"
            aria-label="Login"
          >
            Login
          </button>
          <button
            type="button"
            className="flex min-w-[120px] cursor-pointer items-center justify-center rounded-full bg-[#006400] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a5c1a] hover:shadow-md"
            aria-label="Register"
          >
            Register
          </button>
        </div>
      </div>
    </header>
  );
}