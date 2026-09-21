// packages/ui/src/components/Chat/ChatView.tsx
//
// Presentational chat surface: message bubbles, per-answer SOURCE citations,
// a typing cursor for the in-flight streamed answer, and the input bar.
//
// Sources render as a compact list under assistant messages — each entry maps
// to a [Source n] citation inside the answer text and deep-links to the
// thesis viewer when a thesisId is present.

import { useRef, useEffect } from "react";
import { ArrowUp, BookOpen } from "lucide-react";
import type { ChatMessageResponseDto, ChatSourceDto } from "@monteai/types";
import { ChatMessageSkeleton } from "./skeletons";

export interface ChatViewProps {
  messages: ChatMessageResponseDto[];
  input: string;
  isSending: boolean;
  /** Id of the assistant message currently streaming (renders the typing cursor); null when idle. */
  streamingMessageId?: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatView({
  messages,
  input,
  isSending,
  streamingMessageId,
  onInputChange,
  onSend,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While an assistant placeholder is streaming, the growing bubble replaces
  // the skeleton; the skeleton only covers the pre-answer agent phase.
  const isStreamingAssistant = Boolean(streamingAssistantPresent(messages, streamingMessageId));

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
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-on-primary"
                  : "mr-auto bg-surface-container text-on-surface"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">
                {m.content}
                {m.id === streamingMessageId && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-on-surface align-text-bottom" />
                )}
              </div>

              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <SourcesPanel sources={m.sources} />
              )}
            </div>
          ))}

          {isSending && !isStreamingAssistant && <ChatMessageSkeleton />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
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

/** True when the tracked streaming id still points at a live assistant bubble. */
function streamingAssistantPresent(
  messages: ChatMessageResponseDto[],
  streamingMessageId?: string | null
): boolean {
  if (!streamingMessageId) return false;
  return messages.some((m) => m.id === streamingMessageId);
}

/**
 * Citation panel: one row per retrieved thesis, ordered as the [Source n]
 * numbers inside the answer. Links to the web thesis viewer when possible.
 */
function SourcesPanel({ sources }: { sources: ChatSourceDto[] }) {
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-outline-variant pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        Sources
      </span>
      {sources.map((source, index) => {
        const label = source.title ?? "Untitled thesis";
        const href = source.thesisId ? `/thesis/view/${source.thesisId}` : undefined;
        const body = (
          <>
            <BookOpen className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="truncate">
              [Source {index + 1}] {label}
              {source.publicationYear ? ` (${source.publicationYear})` : ""}
            </span>
          </>
        );

        return href ? (
          <a
            key={`${source.thesisId ?? index}-${index}`}
            href={href}
            title={source.snippet ?? label}
            className="flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
          >
            {body}
          </a>
        ) : (
          <div
            key={`${source.thesisId ?? index}-${index}`}
            title={source.snippet ?? label}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant"
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
