import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, BookOpen } from "lucide-react";

type SamplePrompt = {
  prompt: string;
  response: string;
  sources: string[];
};

const samplePrompts: SamplePrompt[] = [
  {
    prompt:
      "Help me find related studies on secondary science pedagogy and literacy interventions.",
    response:
      "I found several relevant studies that match your criteria. Here are the top entries from the Colegio de Montalban institutional repository under the Institute of Teacher Education (ITE):",
    sources: [
      "Castillo, Naval, & Soriano (2024) - Inquiry-Based Learning Modalities in Secondary Science (BSEd Science)",
      "Reyes, Bautista, & Lim (2023) - Early Childhood Literacy Interventions Using Storytelling (BEEd ECED)",
    ],
  },
  {
    prompt:
      "What research methodologies are commonly used in BSIT and BSCpE capstones at CDM?",
    response:
      "Across cataloged 2023–2024 CDM Institute of Computer Studies (ICS) capstones, predominant methodologies include Agile Scrum, embedded IoT sensor networks, and ISO/IEC 25010 software quality evaluation models.",
    sources: [
      "Martinez, Flores, & Ramos (2024) - Automated Campus Energy Monitoring and IoT Power Optimization (BSCpE)",
      "Santos, Dela Cruz, & Naval (2024) - Adaptive Gamification in Primary School Literacy (BSIT)",
    ],
  },
  {
    prompt:
      "What are the recommended future studies on HRM practices and entrepreneurship in Montalban?",
    response:
      "Recent CDM studies from the Institute of Business and Entrepreneurship (IBE) recommend analyzing employee training frameworks and digital financial sustainability for young entrepreneurs.",
    sources: [
      "Alvarez, Mendoza, & Bautista (2023) - Human Resource Development Management of Montalban Enterprises (BSBA HRDM)",
      "Gonzales, Tan, & Domingo (2024) - Digital Marketing and Financial Sustainability of Montalban Startups (BSE)",
    ],
  },
];

export default function ChatPreview() {
  const ref = useRef<HTMLElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  const current = samplePrompts[selectedIndex];

  return (
    <section
      ref={ref}
      aria-label="MonteAI conversation preview"
      id="assistant"
      className="reveal-section relative w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        {/* 2-Column Grid on lg: Left info + prompt selectors, Right chat window */}
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Explanatory & Interactive Prompt Prompts (5 cols) */}
          <div className="lg:col-span-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary sm:text-sm">
              MonteAI in Action
            </p>
            <h2 className="mt-2 text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl">
              Your research assistant, always ready
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
              Ask research questions and get concise responses informed by
              relevant repository material. Review available citations against
              the original studies.
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Illustrative preview: the answers and study references below are
              examples, not live repository results.
            </p>

            {/* Clickable prompt suggestions */}
            <div className="mt-8 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface">
                Try asking MonteAI:
              </p>
              {samplePrompts.map((item, idx) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`flex w-full text-left items-start gap-3 rounded-xl border p-3.5 text-xs transition-all ${
                    selectedIndex === idx
                      ? "border-primary bg-primary/10 font-semibold text-primary shadow-sm"
                      : "border-outline-variant/60 bg-surface text-on-surface-variant hover:border-primary/40 hover:bg-surface-container"
                  }`}
                >
                  <Sparkles
                    size={16}
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <span className="line-clamp-2">{item.prompt}</span>
                </button>
              ))}
            </div>

            {/* Source reliability note */}
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-4 text-xs text-on-surface-variant">
              <ShieldCheck size={22} className="shrink-0 text-primary" />
              <div>
                <span className="font-bold text-on-surface">
                  Repository-informed responses:{" "}
                </span>
                MonteAI can cite retrieved CDM research, but answers may be
                incomplete or inaccurate. Verify important details in the cited
                manuscripts.
              </div>
            </div>
          </div>

          {/* Right Column: Chat Window Mockup (7 cols) */}
          <div className="lg:col-span-7">
            <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface shadow-2xl shadow-primary/10 transition-shadow duration-500 hover:shadow-primary/20">
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-outline-variant/60 bg-surface-container-low px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-3 w-3">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                    <div className="relative h-3 w-3 rounded-full bg-primary" />
                  </div>
                  <span className="text-sm font-bold tracking-wide text-primary">
                    MonteSkolar Copilot
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Repository Search
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                  <BookOpen size={15} />
                  <span>Repository Connected</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex flex-col gap-6 p-6 sm:p-8">
                {/* User Message */}
                <div className="chat-msg-user flex justify-end">
                  <div className="max-w-[28rem] rounded-2xl rounded-br-sm bg-surface-container p-4 sm:p-5">
                    <p className="text-xs leading-relaxed text-on-surface sm:text-sm">
                      {current.prompt}
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="chat-msg-ai max-w-[36rem] rounded-2xl rounded-bl-sm bg-primary/10 border border-primary/20 p-5 sm:p-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-primary" />
                      <span className="text-xs font-bold text-primary">
                        MonteAI Synthesis
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-on-surface sm:text-sm">
                      {current.response}
                    </p>
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        Referenced CDM Manuscripts:
                      </p>
                      <ul className="flex flex-col gap-2">
                        {current.sources.map((study) => (
                          <li
                            key={study}
                            className="flex items-center gap-2 rounded-lg bg-surface/80 p-2 text-xs font-medium text-primary shadow-xs"
                          >
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="truncate">{study}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <form
                  className="flex w-full flex-col pt-2"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <label htmlFor="monteai-prompt" className="sr-only">
                    Ask MonteSkolar anything
                  </label>
                  <div className="flex min-h-12 items-center justify-between gap-3 rounded-full bg-surface-container px-4 py-2 transition-shadow duration-300 focus-within:shadow-md focus-within:shadow-primary/10 sm:px-6">
                    <input
                      id="monteai-prompt"
                      name="prompt"
                      type="text"
                      placeholder="Ask MonteSkolar about CDM research..."
                      aria-label="Ask MonteSkolar anything"
                      className="min-w-0 flex-1 bg-transparent text-xs text-on-surface outline-none placeholder:text-outline sm:text-sm"
                    />
                    <Link
                      to="/login"
                      className="flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-xs font-bold text-on-primary shadow-sm transition-all duration-300 hover:bg-primary-container"
                    >
                      Launch Now
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
