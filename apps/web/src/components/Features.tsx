import { useEffect, useRef } from "react";
import icon from "../assets/icon.svg";
import icon2 from "../assets/icon-2.svg";
import image from "../assets/image.svg";
import FeatureCard from "./FeatureCard";

const featureCards = [
  {
    title: "AI Research Assistance",
    description:
      "Ask questions about CDM research. MonteSkolar searches the repository and can summarize relevant material when matches are available; check the cited studies for details.",
    iconSrc: icon,
    iconAlt: "AI research assistance icon",
  },
  {
    title: "Thesis Repository",
    description:
      "A centralized digital collection of published thesis and capstone manuscripts from Colegio de Montalban. Browse and access institutional research previously restricted to hardbound library shelves.",
    iconSrc: image,
    iconAlt: "Thesis repository icon",
  },
  {
    title: "Intelligent Search",
    description:
      "Go beyond simple keywords. Semantic search helps find CDM studies related to your methodology and research focus; review the results to decide what is relevant.",
    iconSrc: icon2,
    iconAlt: "Intelligent search icon",
  },
];

export default function Features() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => e.isIntersecting && el.classList.add("animate-in"),
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="features"
      aria-labelledby="features-heading"
      className="reveal-section relative w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
            Core Platform Capabilities
          </p>
          <h2
            id="features-heading"
            className="text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl"
          >
            Built for Thesis Researchers
          </h2>
          <p className="mx-auto mt-4 text-base leading-relaxed text-on-surface-variant sm:text-lg">
            Explore Colegio de Montalban&#39;s institutional research with
            AI-assisted search and summaries. Responses depend on available
            repository matches and should be checked against cited studies.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {featureCards.map((card, i) => (
            <FeatureCard key={card.title} {...card} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
