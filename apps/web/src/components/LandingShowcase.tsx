import {
  ArrowUpRight,
  BookOpen,
  FileSearch,
  Users,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { thesisService } from "../lib/thesisService";
import {
  instituteMatchesProgram,
  THESIS_PROGRAMS,
  type ThesisResponseDto,
} from "@monteai/types";
import promoVideo from "../assets/promo-video.mp4";

type Study = {
  type: string;
  category: string;
  title: string;
  author: string;
  year: string;
  detail: string;
};

const MAX_PREVIEW_STUDIES = 5;

const instituteCode = (institute?: string) =>
  THESIS_PROGRAMS.find(({ code }) => instituteMatchesProgram(institute, code))
    ?.code ?? "Other";

function toStudy(thesis: ThesisResponseDto): Study {
  const date = thesis.approvedAt || thesis.submittedAt || thesis.updatedAt;
  const parsedYear = date ? new Date(date).getFullYear() : NaN;

  return {
    type: "THESIS",
    category: instituteCode(thesis.institute),
    title: thesis.title?.trim() || "Untitled study",
    author: thesis.authors?.filter(Boolean).join(", ") || "Authors not listed",
    year: Number.isNaN(parsedYear) ? "Year not listed" : String(parsedYear),
    detail: thesis.abstract?.trim() || "No abstract provided.",
  };
}

const steps = [
  {
    number: "01",
    title: "Search a topic",
    tagline: "Natural Language Querying",
    description:
      "Explore published thesis and capstone studies from Colegio de Montalban using semantic understanding, not just rigid keywords.",
  },
  {
    number: "02",
    title: "Ask MonteAI",
    tagline: "Contextual Synthesis",
    description:
      "Receive concise responses informed by retrieved CDM studies, with source references when available.",
  },
  {
    number: "03",
    title: "Read and build",
    tagline: "Defense Acceleration",
    description:
      "Open full study metadata, analyze recommended future work, and integrate verified APA 7th citations straight into your paper.",
  },
];

const audiences = [
  {
    title: "Student Researchers",
    role: "Undergraduate Thesis & Capstone Candidates",
    description:
      "Discover verified related studies from prior batches, uncover research gaps, and build defensible literature reviews faster.",
    icon: BookOpen,
  },
  {
    title: "Faculty Advisers",
    role: "Research Mentors & Department Chairs",
    description:
      "Easily verify past studies, prevent topic duplication across school years, and direct advisees to high-quality institutional references.",
    icon: FileSearch,
  },
  {
    title: "Thesis Panelists",
    role: "Academic Reviewers & Subject Experts",
    description:
      "Quickly review historical methodologies and contextualize current student proposals against CDM's evolving research canon.",
    icon: Users,
  },
];

/* Reusable scroll-reveal hook */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && el.classList.add("animate-in"),
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

export default function LandingShowcase() {
  const videoRef = useReveal<HTMLElement>();
  const repoRef = useReveal<HTMLElement>();
  const howRef = useReveal<HTMLElement>();
  const communityRef = useReveal<HTMLElement>();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoadingStudies, setIsLoadingStudies] = useState(true);
  const [studiesLoadFailed, setStudiesLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    thesisService
      .getTheses()
      .then((theses) => {
        if (isMounted) {
          setStudies(
            theses
              .filter((thesis) => thesis.status?.toLowerCase() === "published")
              .map(toStudy)
              .slice(0, MAX_PREVIEW_STUDIES),
          );
        }
      })
      .catch(() => {
        if (isMounted) setStudiesLoadFailed(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingStudies(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredStudies =
    activeCategory === "All"
      ? studies
      : studies.filter((s) => s.category === activeCategory);

  return (
    <>
      {/* ── Video Showcase Section ("A Closer Look") ── */}
      <section
        ref={videoRef}
        id="showcase"
        aria-labelledby="video-heading"
        className="reveal-section relative w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
                MonteSkolar + MonteAI • Research, connected
              </p>
              <h2
                id="video-heading"
                className="mt-2 text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl"
              >
                Research, made easier to explore
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
              MonteSkolar helps you discover Colegio de Montalban research
              archive. MonteAI helps you explore relevant studies and understand
              their sources—so you can build your work on research you can
              verify.
            </p>
          </div>

          {/* Video and platform benefits */}
          <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-outline-variant/60 bg-on-surface shadow-2xl shadow-primary/10 lg:col-span-8">
              <video
                src={promoVideo}
                aria-label="MonteSkolar and MonteAI platform showcase"
                autoPlay
                controls
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-outline-variant/60 bg-surface-container-low p-6 sm:p-8 lg:col-span-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Why use MonteSkolar + MonteAI?
                </p>
                <h3 className="mt-1 text-xl font-bold text-on-surface sm:text-2xl">
                  From finding studies to understanding them
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                  Use one connected experience to discover CDM research, ask
                  better questions, and follow insights back to their sources.
                </p>

                {/* Feature stack */}
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-outline-variant/40 bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileSearch size={16} />
                      </span>
                      <h4 className="text-sm font-bold text-on-surface">
                        Find studies by meaning
                      </h4>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                      MonteSkolar helps you discover relevant studies by topic
                      or concept, even when you do not know an exact title.
                    </p>
                  </div>

                  <div className="rounded-xl border border-outline-variant/40 bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles size={16} />
                      </span>
                      <h4 className="text-sm font-bold text-on-surface">
                        Understand answers with sources
                      </h4>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                      MonteAI connects its research assistance to relevant CDM
                      studies, so you can review the source material.
                    </p>
                  </div>

                  <div className="rounded-xl border border-outline-variant/40 bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ShieldCheck size={16} />
                      </span>
                      <h4 className="text-sm font-bold text-on-surface">
                        Build a stronger research foundation
                      </h4>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                      Explore what previous studies cover and where your own
                      research can contribute.
                    </p>
                  </div>
                </div>
              </div>

              {/* Promotional CTA */}
              <div className="mt-6 border-t border-outline-variant/50 pt-4">
                <Link
                  to="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-on-primary transition hover:bg-primary-container"
                >
                  Start Your Research
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Digital Thesis Repository Section ── */}
      <section
        ref={repoRef}
        id="repository"
        aria-labelledby="repository-heading"
        className="reveal-section border-y border-outline-variant/50 bg-surface-container-low px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Repository description (5 cols) */}
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
                Digital Thesis Repository
              </p>
              <h2
                id="repository-heading"
                className="mt-2 text-3xl font-extrabold leading-tight text-on-surface sm:text-4xl lg:text-5xl"
              >
                A growing home for CDM research
              </h2>
              <p className="mt-4 leading-relaxed text-on-surface-variant sm:text-base">
                Browse published thesis and capstone studies in one centralized
                archive. Find research by program, inspect validated
                methodologies, and follow sources directly into your paper.
              </p>

              {/* Department tags */}
              <div className="mt-6 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Participating Institutes:
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-outline-variant/60 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
                    Institute of Teacher Education (ITE)
                  </span>
                  <span className="rounded-lg border border-outline-variant/60 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
                    Institute of Computer Studies (ICS)
                  </span>
                  <span className="rounded-lg border border-outline-variant/60 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
                    Institute of Business and Entrepreneurship (IBE)
                  </span>
                </div>
              </div>

              {/* Feature check list */}
              <div className="mt-6 space-y-2 text-xs sm:text-sm text-on-surface-variant">
                <div className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>Full-text search across hardbound archives</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>Verified CDM manuscript data</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>One-click APA 7th citation formatting</span>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary-container"
                >
                  Browse Full Catalog
                  <ArrowUpRight size={16} />
                </Link>
                <a
                  href="#assistant"
                  className="text-sm font-semibold text-primary transition hover:underline"
                >
                  See MonteAI in action →
                </a>
              </div>
            </div>

            {/* Right Column: Interactive Repository Preview Card (7 cols) */}
            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface shadow-xl">
                {/* Header with Category Filter Tabs */}
                <div className="border-b border-outline-variant/60 bg-surface-container px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="text-primary" size={20} />
                      <span className="font-bold text-on-surface">
                        Institutional Research Collection
                      </span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {filteredStudies.length} of {studies.length} Studies
                      Previewed
                    </span>
                  </div>

                  {/* Program filter tabs */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["All", ...THESIS_PROGRAMS.map(({ code }) => code)].map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(cat)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            activeCategory === cat
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"
                          }`}
                        >
                          {cat === "All" ? "All Institutes" : cat}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Studies list */}
                <div className="divide-y divide-outline-variant/40">
                  {filteredStudies.map((study) => (
                    <article
                      key={study.title}
                      className="group flex flex-col gap-2 p-5 transition-colors duration-200 hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-4 sm:p-6"
                    >
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                        <FileSearch size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-primary-container px-2 py-0.5 text-[11px] font-bold text-on-primary">
                            {study.category}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            {study.type} • {study.year}
                          </span>
                          <span className="ml-auto text-xs text-on-surface-variant font-medium">
                            {study.author}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                          {study.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                          {study.detail}
                        </p>
                      </div>
                      <Link
                        to="/login"
                        className="mt-2 sm:mt-0 sm:ml-auto self-end sm:self-center shrink-0 rounded-lg p-2 text-outline transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                        aria-label={`Open study: ${study.title}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </article>
                  ))}
                  {isLoadingStudies && (
                    <p className="p-8 text-center text-sm text-on-surface-variant">
                      Loading published research...
                    </p>
                  )}
                  {!isLoadingStudies && studiesLoadFailed && (
                    <p className="p-8 text-center text-sm text-on-surface-variant">
                      The research collection is currently unavailable.
                    </p>
                  )}
                  {!isLoadingStudies &&
                    !studiesLoadFailed &&
                    filteredStudies.length === 0 && (
                      <p className="p-8 text-center text-sm text-on-surface-variant">
                        No published studies are currently available.
                      </p>
                    )}
                </div>

                {/* Footer preview note */}
                <div className="border-t border-outline-variant/50 bg-surface-container-low px-6 py-3 text-center text-xs text-on-surface-variant">
                  Accessing full text requires logging in with your official CDM
                  institutional credentials.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section
        ref={howRef}
        id="how-it-works"
        aria-labelledby="how-heading"
        className="reveal-section relative w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
              Streamlined 3-Step Process
            </p>
            <h2
              id="how-heading"
              className="mt-2 text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl"
            >
              From question to useful research
            </h2>
            <p className="mt-3 text-base text-on-surface-variant">
              Engineered to make your literature review, methodology synthesis,
              and defense prep effortless.
            </p>
          </div>

          {/* 3 Expansive Cards spanning full max-w-7xl */}
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
              >
                {/* Large watermark number */}
                <div className="absolute -right-3 -top-3 text-[6rem] font-black leading-none text-primary/5 transition-colors group-hover:text-primary/10 select-none">
                  {step.number}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-block rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                      Step {step.number}
                    </span>
                    <span className="text-xs font-semibold text-outline">
                      {step.tagline}
                    </span>
                  </div>

                  <h3 className="mt-5 text-2xl font-bold text-on-surface">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <span>Explore Step</span>
                  <ArrowUpRight size={14} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community Section ── */}
      <section
        ref={communityRef}
        id="community"
        aria-labelledby="community-heading"
        className="reveal-section relative overflow-hidden bg-primary px-4 py-16 text-on-primary sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      >
        {/* Subtle decorative mesh overlay */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-container/40 via-transparent to-primary-container/20"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-primary-container sm:text-sm">
              Made for the Entire Colegio de Montalban Community
            </p>
            <h2
              id="community-heading"
              className="mt-2 text-3xl font-extrabold sm:text-4xl lg:text-5xl"
            >
              One research home, shared by CDM
            </h2>
            <p className="mt-3 text-base text-on-primary/80">
              Connecting researchers, thesis mentors, and department panelists
              to elevate academic excellence.
            </p>
          </div>

          {/* 3 Audience Cards spanning max-w-7xl */}
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {audiences.map(({ title, role, description, icon: Icon }) => (
              <article
                key={title}
                className="group flex flex-col justify-between rounded-2xl border border-on-primary/15 bg-on-primary/10 p-7 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-on-primary/15"
              >
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-on-primary/15 transition-transform duration-300 group-hover:scale-110">
                    <Icon size={26} className="text-on-primary" />
                  </div>
                  <h3 className="mt-5 text-2xl font-bold">{title}</h3>
                  <p className="mt-1 text-xs font-semibold text-on-primary-container uppercase tracking-wider">
                    {role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-on-primary/80">
                    {description}
                  </p>
                </div>

                <div className="mt-6 border-t border-on-primary/10 pt-4 text-xs font-semibold text-on-primary-container flex items-center justify-between">
                  <span>Authorized CDM Access</span>
                  <ArrowUpRight size={15} />
                </div>
              </article>
            ))}
          </div>

          {/* Institutional Trust Banner */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-xl border border-on-primary/20 bg-black/20 p-6 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-base font-bold text-on-primary">
                Colegio de Montalban Institutional Research Integrity
              </p>
              <p className="text-xs text-on-primary/75">
                Preserving scholarship, accelerating inquiry, and empowering the
                next generation of researchers.
              </p>
            </div>
            <Link
              to="/register"
              className="shrink-0 rounded-full bg-on-primary px-6 py-2.5 text-xs font-bold text-primary transition hover:bg-surface-container-high"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
