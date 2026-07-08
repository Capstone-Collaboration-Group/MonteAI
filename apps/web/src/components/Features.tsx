import icon from "../assets/icon.svg";
import icon2 from "../assets/icon-2.svg";
import image from "../assets/image.svg";
import FeatureCard from "./FeatureCard";

const featureCards = [
  {
    title: "AI Research Assistance",
    description:
      "Get instant, research-grounded answers from CDM's published thesis and capstone studies. Just type your research topic and MonteSkolar will find and summarize the most relevant studies for you.",
    iconSrc: icon,
    iconAlt: "AI research assistance icon",
    iconClassName: "w-[50px] h-[50px]",
    cardClassName: "w-full",
    descriptionWrapperClassName: "pl-0 pr-0",
    descriptionClassName: "text-base text-[#3f4a3a]",
    titleNode: (
      <div className="text-2xl font-semibold text-[#1b1b1c] [font-family:'Inter-SemiBold',Helvetica]">
        AI Research Assistance
      </div>
    ),
  },
  {
    title: "Thesis Repository",
    description:
      "A centralized digital collection of all published thesis and capstone studies from Colegio de Montalban. Browse, search, and access institutional research that was previously only available as hardbound copies in the library.",
    iconSrc: image,
    iconAlt: "Thesis repository icon",
    iconClassName: "w-[50px] h-[50px]",
    cardClassName: "w-full",
    descriptionWrapperClassName: "pl-0 pr-0",
    descriptionClassName: "text-base text-[#3f4a3a]",
    titleNode: (
      <div className="text-2xl font-semibold text-[#1b1b1c] [font-family:'Inter-SemiBold',Helvetica]">
        Thesis Repository
      </div>
    ),
  },
  {
    title: "Intelligent Search",
    description:
      "Go beyond simple keyword searching. MonteSkolar understands the meaning behind your research query and retrieves the most relevant CDM thesis studies that match your topic, methodology, or research area.",
    iconSrc: icon2,
    iconAlt: "Intelligent search icon",
    iconClassName: "w-[50px] h-[50px]",
    cardClassName: "w-full",
    descriptionWrapperClassName: "pl-0 pr-0",
    descriptionClassName: "text-base text-[#3f4a3a]",
    titleNode: (
      <p className="text-2xl font-semibold text-[#1b1b1c] [font-family:'Inter-SemiBold',Helvetica]">
        <span className="font-semibold">Intelligent</span>
        <span className="[font-family:'Manrope-SemiBold',Helvetica] font-semibold"> Search</span>
      </p>
    ),
  },
];

export default function Features() {
  return (
    <section aria-labelledby="features-heading" className="px-4 py-16 sm:px-6 lg:px-0">
      <div className="mx-auto max-w-5xl text-center">
        <h2
          id="features-heading"
          className="[font-family:'Inter-ExtraBold',Helvetica] text-3xl font-extrabold text-[#1b1b1c] sm:text-4xl"
        >
          Built for Thesis Researchers
        </h2>
        <p className="mx-auto mt-4 max-w-3xl [font-family:'Inter-Regular',Helvetica] text-base leading-7 text-[#3f4a3a]">
          The power of AI meets the depth of CDM&#39;s institutional research.
          MonteSkolar delivers accurate, source-grounded answers drawn exclusively
          from Colegio de Montalban&#39;s own published academic studies.
        </p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {featureCards.map((card) => (
          <FeatureCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}