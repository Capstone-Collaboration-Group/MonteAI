// pages/Home.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, ChevronDown, Clock } from "lucide-react";
import { Card } from "@monteai/ui";

const suggestions = [
  {
    tag: "Resume",
    title: "Can you help me refine my related literature review section?",
    meta: "New chat · Apr 28",
  },
  {
    tag: "Suggested",
    title: "Justifications for weighted mean and standard deviation in IT studies",
  },
  {
    tag: "Suggested",
    title: "Compare frequency count, percentage distribution, and weighted mean usage in IT surveys",
  },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const goToChat = (initialPrompt: string) => {
    if (!initialPrompt.trim()) return;
    navigate("/chat", { state: { initialPrompt } });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToChat(prompt);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface px-6">
      <div className="w-full max-w-3xl">
        <h1 className="mb-6 text-center text-2xl font-medium text-on-surface">
          Welcome back
        </h1>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[32px] border border-outline-variant bg-surface shadow-lg"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between bg-primary px-6 py-4">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-on-primary/15 px-4 py-2 text-sm font-semibold text-on-primary"
            >
              <MessageSquare className="h-4 w-4" />
              New chat
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Prompt area */}
          <div className="min-h-[160px] px-6 py-6">
            <textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask MonteAI anything about your thesis..."
              rows={3}
              className="w-full resize-none bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  goToChat(prompt);
                }
              }}
            />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-3">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant"
            >
              Source <span className="font-semibold text-on-surface">Thesis repository</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary transition disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Suggestion cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {suggestions.map((s) => (
            <Card
              key={s.title}
              onClick={() => goToChat(s.title)}
              className="cursor-pointer transition hover:-translate-y-0.5 hover:border-primary"
            >
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                {s.tag === "Resume" && <Clock className="h-3 w-3" />}
                {s.tag}
              </span>
              <p className="text-sm text-on-surface">{s.title}</p>
              {s.meta && <p className="mt-2 text-xs text-on-surface-variant">{s.meta}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
