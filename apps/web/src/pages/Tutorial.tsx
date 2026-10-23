import { PageSidebar } from "../components/PageSidebar";
import { BookOpen, Search, Quote, Lightbulb, Wrench } from "lucide-react";

import TutorialHero from "../sections/TutorialHero";
import GettingStarted from "../sections/GettingStarted";
import HowToQuery from "../sections/HowToQuery";
import CitingSources from "../sections/CitingSources";
import TipsBestPractices from "../sections/TipsBestPractices";

const TUTORIAL_SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: <BookOpen className="h-5 w-5" /> },
  { id: "how-to-query", label: "How to Query", icon: <Search className="h-5 w-5" /> },
  { id: "citing-sources", label: "Citing Sources", icon: <Quote className="h-5 w-5" /> },
  { id: "tips-best-practices", label: "Tips & Best Practices", icon: <Lightbulb className="h-5 w-5" /> },
  { id: "troubleshooting", label: "Troubleshooting", icon: <Wrench className="h-5 w-5" /> },
] as const;

export default function Tutorial() {
  return (
    <PageSidebar
      sections={TUTORIAL_SECTIONS}
      title="Tutorial & Guide"
      subtitle="Master MonteAI for your research"
    >
      <TutorialHero />
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "getting-started")}>
        <GettingStarted />
      </div>
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "how-to-query")}>
        <HowToQuery />
      </div>
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "citing-sources")}>
        <CitingSources />
      </div>
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "tips-best-practices")}>
        <TipsBestPractices />
      </div>
    </PageSidebar>
  );
}