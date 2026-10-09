import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  Search,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && el.classList.add("animate-in"),
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const trendingTopics = [
    "BSIT Capstone",
    "BSEd Science",
    "BSCpE Embedded Systems",
    "BSBA HRDM",
    "BEEd Literacy",
    "BSE Entrepreneurship",
  ];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-heading"
      className="hero-section relative w-full overflow-hidden bg-gradient-to-b from-primary/5 via-surface to-surface pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24"
    >
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="hero-orb hero-orb--1" />
        <div className="hero-orb hero-orb--2" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary-container)_0%,_transparent_65%)] opacity-10" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main 3-Column Hero Grid: Left Flank, Center Main, Right Flank */}
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-8">
          {/* Left Promotional Flank (Visible on LG/XL to occupy side space) */}
          <div className="hidden lg:col-span-3 lg:flex flex-col gap-6 justify-center">
            {/* Card 1: Institutional archive */}
            <div className="animate-float-1 rounded-2xl border border-outline-variant/60 bg-surface/90 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    CDM Research Archive
                  </p>
                  <p className="text-base font-bold text-on-surface">
                    Published studies
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                Browse published manuscripts currently available in the
                institutional repository.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-primary">
                  ITE
                </span>
                <span className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-primary">
                  ICS
                </span>
                <span className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-primary">
                  IBE
                </span>
              </div>
            </div>

            {/* Card 2: Repository-Sourced Responses */}
            <div className="animate-float-2 rounded-2xl border border-outline-variant/60 bg-surface/90 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    CDM Repository
                  </p>
                  <p className="text-base font-bold text-on-surface">
                    Source-aware answers
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                MonteAI can use retrieved Colegio de Montalban research as
                context and include source references when available.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <CheckCircle2 size={14} />
                <span>Review cited research sources</span>
              </div>
            </div>
          </div>

          {/* Center Main Hero Column */}
          <div className="flex flex-col items-center text-center lg:col-span-6">
            <p className="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-primary backdrop-blur-sm">
              Colegio de Montalban Research, Connected
            </p>

            <h1
              id="hero-heading"
              className="hero-title text-balance text-4xl font-black leading-[1.1] text-on-surface sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              Your AI-powered{" "}
              <span className="bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                thesis library
              </span>
            </h1>

            <p className="hero-subtitle mt-6 max-w-2xl text-base font-medium leading-relaxed text-on-surface-variant sm:text-lg lg:text-xl">
              Simplify your thesis research journey. Search published CDM
              studies, get AI-powered answers, and access your institution&#39;s
              research repository anytime, anywhere — all in one platform.
            </p>

            {/* CTAs */}
            <div className="hero-actions mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/login"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-primary px-9 py-4 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Explore MonteSkolar
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
                <span className="absolute inset-0 -translate-x-full bg-primary-container transition-transform duration-500 group-hover:translate-x-0" />
              </Link>
              <a
                href="#showcase"
                className="inline-flex items-center justify-center rounded-full border border-outline px-9 py-4 text-sm font-semibold text-on-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5"
              >
                Watch Platform Tour
              </a>
            </div>

            {/* Live Interactive Search Bar Mockup */}
            <div className="mt-8 w-full max-w-xl">
              <div className="flex items-center rounded-full border border-outline-variant/70 bg-surface/80 p-1.5 shadow-md backdrop-blur-md transition-all focus-within:border-primary focus-within:shadow-lg focus-within:shadow-primary/10">
                <Search size={18} className="ml-3 text-outline" />
                <input
                  type="text"
                  readOnly
                  value="E.g. BSEd Science modules, BSCpE smart campus, or BSBA HRDM..."
                  className="min-w-0 flex-1 bg-transparent px-3 text-xs sm:text-sm text-on-surface-variant outline-none select-none cursor-pointer"
                  onClick={() => window.location.assign("/login")}
                />
                <Link
                  to="/login"
                  className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition hover:bg-primary-container"
                >
                  Search CDM
                </Link>
              </div>

              {/* Trending Topic Pills */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-on-surface-variant">
                <span className="font-semibold text-on-surface">Trending:</span>
                {trendingTopics.map((topic) => (
                  <Link
                    key={topic}
                    to="/login"
                    className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-medium transition hover:bg-primary/10 hover:text-primary"
                  >
                    {topic}
                  </Link>
                ))}
              </div>
            </div>

            <p className="hero-meta mt-6 text-xs text-on-surface-variant sm:text-sm">
              Tailored for CDM student researchers, faculty advisers, and thesis
              panelists
            </p>
          </div>

          {/* Right Promotional Flank (Visible on LG/XL to occupy side space) */}
          <div className="hidden lg:col-span-3 lg:flex flex-col gap-6 justify-center">
            {/* Card 3: MonteAI Copilot */}
            <div className="animate-float-2 rounded-2xl border border-outline-variant/60 bg-surface/90 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    MonteAI Assistant
                  </p>
                  <p className="text-base font-bold text-on-surface">
                    Research summaries
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                Ask research questions and explore AI-generated summaries based
                on retrieved CDM manuscripts.
              </p>
              <div className="mt-3 text-xs font-semibold text-primary">
                Source references when available
              </div>
            </div>

            {/* Card 4: Defense Prep */}
            <div className="animate-float-1 rounded-2xl border border-outline-variant/60 bg-surface/90 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <GraduationCap size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Research Preparation
                  </p>
                  <p className="text-base font-bold text-on-surface">
                    Explore related studies
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                Review related repository studies as a starting point for your
                own defense preparation.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <CheckCircle2 size={14} />
                <span>A research aid for CDM scholars</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width Promotional Stats / Social Proof Bar across max-w-7xl */}
        <div className="mt-14 border-t border-outline-variant/40 pt-10 sm:mt-16 sm:pt-12">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:gap-8">
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl font-black text-primary sm:text-3xl lg:text-4xl">
                Published
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface sm:text-sm">
                Thesis Catalog
              </span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                Browse available CDM research
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl font-black text-primary sm:text-3xl lg:text-4xl">
                3
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface sm:text-sm">
                Institutes Connected
              </span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                ITE, ICS, & IBE programs
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl font-black text-primary sm:text-3xl lg:text-4xl">
                CDM
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface sm:text-sm">
                Repository Search
              </span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                Review source references when available
              </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl font-black text-primary sm:text-3xl lg:text-4xl">
                Semantic
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-on-surface sm:text-sm">
                Research Search
              </span>
              <span className="mt-0.5 text-xs text-on-surface-variant">
                Find related studies by topic
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
