import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { useAuth } from "@monteai/hooks"; // adjust to your actual auth hook path

const suggestions = [
  "Summarize recent theses on machine learning in education",
  "Help me draft my related literature section",
  "What research gaps exist in AI-assisted thesis review?",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    navigate("/chat", { state: { initialPrompt: prompt } });
  };

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-center text-2xl font-medium">
          Welcome back, {firstName}
        </h1>

        <form onSubmit={handleSubmit} className="relative mb-4">
          <input
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask MonteAI anything about your thesis..."
            className="w-full rounded-full border border-outline bg-surface px-5 py-3.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary p-2 text-on-primary disabled:opacity-40"
            disabled={!prompt.trim()}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => navigate("/chat", { state: { initialPrompt: s } })}
              className="rounded-full border border-outline px-3.5 py-1.5 text-xs text-on-surface-variant transition hover:bg-surface-variant"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}