// packages/ui/src/components/Chat/ChatView.tsx
import { useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import type { ChatMessageResponseDto } from "@monteai/types";

export interface ChatViewProps {
  messages: ChatMessageResponseDto[];
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatView({
  messages,
  input,
  isSending,
  onInputChange,
  onSend,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && !isSending && (
            <p className="mt-20 text-center text-sm text-on-surface-variant">
              Start the conversation below.
            </p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-on-primary"
                  : "mr-auto bg-surface-container text-on-surface"
              }`}
            >
              {m.content}
            </div>
          ))}

          {isSending && (
            <div className="mr-auto flex items-center gap-2 text-xs text-on-surface-variant">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              MonteAI is thinking...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="border-t border-outline-variant bg-surface-container-low px-6 py-4"
      >
        <div className="relative mx-auto max-w-2xl">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask MonteAI anything..."
            className="w-full rounded-full border border-outline-variant bg-surface px-5 py-3.5 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary p-2 text-on-primary disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="mb-5 text-center text-xs text-on-surface-variant">
        MonteAI can make mistakes, always double check the output.
      </div>
    </div>
  );
}