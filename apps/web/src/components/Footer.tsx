import icon3 from "../assets/icon-3.svg";
import icon4 from "../assets/icon-4.svg";

export default function Footer() {
  return (
    <footer className="mt-20 w-full border-t border-outline-variant/50 bg-surface-container-low py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-12 items-start">
          <div className="lg:col-span-6">
            <span className="text-2xl font-black text-primary">
              MonteSkolar
            </span>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant max-w-md">
              Your institution&#39;s research, now at your fingertips. Bringing
              Colegio de Montalban&#39;s academic knowledge to life through the
              power of AI.
            </p>
            <p className="mt-4 text-xs font-semibold text-primary">
              Colegio de Montalban • Kasama sa Pag-unlad ng Bayan
            </p>
          </div>

          <div className="lg:col-span-3 lg:col-start-10">
            <div className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Contact & Links
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img
                  className="h-4 w-4"
                  alt="email icon"
                  src={icon4}
                  aria-hidden="true"
                />
                <a
                  className="text-xs sm:text-sm text-on-surface-variant hover:text-primary transition-colors underline"
                  href="mailto:info@pnm.edu.ph"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  info@pnm.edu.ph
                </a>
              </div>
              <div className="flex items-center gap-3">
                <img
                  className="h-4 w-4"
                  alt="website icon"
                  src={icon3}
                  aria-hidden="true"
                />
                <a
                  className="text-xs sm:text-sm text-on-surface-variant hover:text-primary transition-colors underline"
                  href="http://pnm.edu.ph"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  pnm.edu.ph
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-outline-variant/30 pt-6 text-center text-xs text-on-surface-variant/70">
          © 2026 MonteSkolar • Colegio de Montalban. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
