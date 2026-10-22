// packages/ui/src/components/Chat/ChatView.tsx
//
// Presentational chat surface: message bubbles, per-answer SOURCE citations,
// a typing cursor for the in-flight streamed answer, and the input bar.
//
// Sources render as a compact list under assistant messages — each entry maps
// to a [Source n] citation inside the answer text and deep-links to the
// thesis viewer when a thesisId is present.
//
// Assistant messages also get Cite / Expand actions:
//   - Cite  → APA 7th-edition panel (per-source copy + Copy all)
//   - Expand → host sends a follow-up asking for a more detailed answer
// The empty state shows SUGGESTION cards (top queries from analytics, with
// a static fallback) that send immediately when tapped.

import { useRef, useEffect, useState, useCallback } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCopy,
  Copy,
  Maximize2,
  Quote,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  ApaCitationDto,
  ChatMessageResponseDto,
  ChatSourceDto,
} from "@monteai/types";
import { ChatMessageSkeleton } from "./skeletons";

export interface ChatViewProps {
  messages: ChatMessageResponseDto[];
  input: string;
  isSending: boolean;
  /** Id of the assistant message currently streaming (renders the typing cursor); null when idle. */
  streamingMessageId?: string | null;
  /** Progress note from the agent ("Searching the repository…") shown while waiting for/through the stream. */
  streamStatus?: string | null;
  /** Terminal send failure shown as a banner above the input bar. */
  error?: string | null;
  /** Prompt suggestions for the empty state (top analytics queries / static fallbacks). */
  suggestions?: string[];
  /** Sends the chosen suggestion immediately (mirrors tapping a home-page card). */
  onSelectSuggestion?: (text: string) => void;
  /** Formats a message's sources as APA 7 references (the "Cite" button). */
  onRequestCitations?: (sources: ChatSourceDto[]) => Promise<ApaCitationDto[]>;
  /** Host handles the "Expand" follow-up (e.g. send("Expand your previous answer…")). */
  onExpand?: (message: ChatMessageResponseDto) => void;
  onDeleteSession?: () => void;
  isDeletingSession?: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatView({
  messages,
  input,
  isSending,
  streamingMessageId,
  streamStatus,
  error,
  suggestions = [],
  onSelectSuggestion,
  onRequestCitations,
  onExpand,
  onDeleteSession,
  isDeletingSession = false,
  onInputChange,
  onSend,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Message whose citation panel is open (or loading). */
  const [citingMessageId, setCitingMessageId] = useState<string | null>(null);
  const [citations, setCitations] = useState<ApaCitationDto[]>([]);
  const [citationsLoading, setCitationsLoading] = useState(false);
  const [citationsError, setCitationsError] = useState<string | null>(null);
  /** Key of the last copied item — row index ("c0") or "all". */
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCite = useCallback(
    async (message: ChatMessageResponseDto) => {
      if (!onRequestCitations || !message.sources?.length) return;

      // Toggle off when clicking Cite on the already-open panel.
      if (citingMessageId === message.id) {
        setCitingMessageId(null);
        setCitations([]);
        setCitationsError(null);
        return;
      }

      setCitingMessageId(message.id);
      setCitations([]);
      setCitationsError(null);
      setCitationsLoading(true);
      try {
        const result = await onRequestCitations(message.sources);
        setCitations(result);
      } catch {
        setCitationsError("Could not format citations. Please try again.");
      } finally {
        setCitationsLoading(false);
      }
    },
    [citingMessageId, onRequestCitations]
  );

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — ignore.
    }
  }, []);

  const copyAllCitations = useCallback(() => {
    if (!citations.length) return;
    copyText(
      citations.map((c) => c.citation).join("\n\n"),
      "all"
    );
  }, [citations, copyText]);

  // While an assistant placeholder is streaming, the growing bubble replaces
  // the skeleton; the skeleton only covers the pre-answer agent phase.
  const isStreamingAssistant = Boolean(streamingAssistantPresent(messages, streamingMessageId));

  return (
    <div className="flex h-full flex-col">
      {onDeleteSession && (
        <div className="flex shrink-0 justify-end border-b border-outline-variant/70 px-3 py-2 sm:px-6">
          <button
            type="button"
            onClick={onDeleteSession}
            disabled={isDeletingSession || isSending}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete this chat"
          >
            <Trash2 className="h-4 w-4" />
            Delete chat
          </button>
        </div>
      )}

      {/* ── Message list ── */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && !isSending && (
            <div className="mt-20 flex flex-col items-center gap-5">
              <p className="text-center text-sm text-on-surface-variant">
                Start the conversation below.
              </p>
              {suggestions.length > 0 && onSelectSuggestion && (
                <div className="flex w-full flex-col gap-2">
                  {suggestions.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => onSelectSuggestion(text)}
                      className="rounded-xl border border-outline-variant bg-surface px-4 py-3 text-left text-sm text-on-surface transition-colors hover:border-primary hover:bg-surface-container"
                    >
                      <Sparkles className="mr-2 inline h-3.5 w-3.5 text-primary" />
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m) => {
            const isStreamingThis = m.id === streamingMessageId;
            const showCite =
              m.role === "assistant" &&
              !isStreamingThis &&
              Boolean(m.sources?.length) &&
              Boolean(onRequestCitations);
            const showExpand =
              m.role === "assistant" && !isStreamingThis && Boolean(onExpand);

            return (
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
                  {isStreamingThis && (
                    <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-on-surface align-text-bottom" />
                  )}
                </div>

                {(showCite || showExpand) && (
                  <div className="mt-2 flex items-center gap-3 border-t border-outline-variant pt-2">
                    {showCite && (
                      <button
                        type="button"
                        onClick={() => handleCite(m)}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-primary ${
                          citingMessageId === m.id ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {citingMessageId === m.id ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <Quote className="h-3 w-3" />
                        )}
                        Cite
                      </button>
                    )}
                    {showExpand && (
                      <button
                        type="button"
                        onClick={() => onExpand?.(m)}
                        disabled={isSending}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Maximize2 className="h-3 w-3" />
                        Expand
                      </button>
                    )}
                  </div>
                )}

                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <>
                    {citingMessageId === m.id ? (
                      <CitationPanel
                        citations={citations}
                        isLoading={citationsLoading}
                        error={citationsError}
                        copiedKey={copiedKey}
                        onCopy={(text, key) => copyText(text, key)}
                        onCopyAll={copyAllCitations}
                        onClose={() => setCitingMessageId(null)}
                      />
                    ) : (
                      <SourcesPanel sources={m.sources} />
                    )}
                  </>
                )}
              </div>
            );
          })}

          {isSending && !isStreamingAssistant && <ChatMessageSkeleton />}

          {isSending && streamStatus && (
            <p className="animate-pulse text-center text-xs text-on-surface-variant">
              {streamStatus}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <div className="border-t border-outline-variant bg-surface-container-low px-3 py-2 text-center text-xs text-red-600 sm:px-6">
          {error}
        </div>
      )}

      {/* ── Input bar ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="border-t border-outline-variant bg-surface-container-low px-3 py-3 sm:px-6 sm:py-4"
      >
        <div className="relative mx-auto max-w-2xl">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask MonteAI anything..."
            className="w-full rounded-full border border-outline-variant bg-surface px-4 py-3 pr-12 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary sm:px-5 sm:py-3.5"
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

      <div className="shrink-0 px-2 pb-2 text-center text-[11px] text-on-surface-variant sm:mb-5 sm:pb-0 sm:text-xs">
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
 * Chat sources persisted while Pinecone metadata was read through
 * MetadataValue.ToString() carry JSON-quoted ids ("c09a…"). Strip any
 * surrounding quotes so old messages still deep-link to a valid URL.
 */
function cleanThesisId(id: string): string {
  return id.replace(/^"+|"+$/g, "");
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
        const thesisId = source.thesisId ? cleanThesisId(source.thesisId) : "";
        const href = thesisId ? `/thesis/view/${thesisId}` : undefined;
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
            key={`${thesisId || index}`}
            href={href}
            title={source.snippet ?? label}
            className="flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
          >
            {body}
          </a>
        ) : (
          <div
            key={`${thesisId || index}`}
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

interface CitationPanelProps {
  citations: ApaCitationDto[];
  isLoading: boolean;
  error: string | null;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  onCopyAll: () => void;
  onClose: () => void;
}

/**
 * APA 7th-edition citation panel (the "Cite" action): one copyable reference
 * per source plus a Copy all button.
 */
function CitationPanel({
  citations,
  isLoading,
  error,
  copiedKey,
  onCopy,
  onCopyAll,
  onClose,
}: CitationPanelProps) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-outline-variant pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          APA 7th edition citations
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Hide
        </button>
      </div>

      {isLoading && (
        <p className="animate-pulse text-xs text-on-surface-variant">
          Formatting citations…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {citations.map((citation, index) => {
        const key = `c${index}`;
        return (
          <div key={`${citation.thesisId ?? "source"}-${index}`} className="flex items-start gap-2">
            <p className="flex-1 select-text text-xs leading-relaxed text-on-surface">
              {citation.citation}
            </p>
            <button
              type="button"
              onClick={() => onCopy(citation.citation, key)}
              title="Copy citation"
              className="mt-0.5 shrink-0 rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
            >
              {copiedKey === key ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        );
      })}

      {!isLoading && !error && citations.length > 0 && (
        <button
          type="button"
          onClick={onCopyAll}
          className="mt-0.5 inline-flex w-fit items-center gap-1.5 self-start rounded-md border border-outline-variant px-2 py-1 text-[11px] font-medium text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
        >
          {copiedKey === "all" ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <ClipboardCopy className="h-3 w-3" />
          )}
          {copiedKey === "all" ? "Copied" : "Copy all"}
        </button>
      )}
    </div>
  );
}
