// packages/ui/src/pages/ChatPage.tsx
//
// Chat page orchestration: session bootstrap, message history, sending, and
// STREAMING the agent's answer.
//
// Send flow (streaming path):
//   1. Optimistically append the user's message.
//   2. Append an empty assistant "placeholder" bubble (its id is tracked in
//      streamingAssistantId so ChatView renders a typing cursor).
//   3. chatService.sendMessageStream fires:
//        onSources -> fills the placeholder's sources (citation panel)
//        onDelta   -> grows the placeholder's content token by token
//      and resolves with the final persisted message.
//   4. Replace the placeholder with the canonical server message.
//
//   Falls back to the blocking sendMessage when a custom chatService does
//   not implement streaming.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatService } from "@monteai/api";
import { ChatStreamAbortedError } from "@monteai/api";
import type { ChatMessageResponseDto, ChatSourceDto } from "@monteai/types";
import { useDeleteChatSession } from "@monteai/hooks";
import { ChatView } from "../components/Chat/ChatView";
import { ChatPageSkeleton } from "../components/Chat/skeletons";
import { ConfirmDialog } from "../components/common";
import { toast } from "../components/toast";
import { MonteAvatar, type AvatarActivity, type AvatarEmotion } from "../avatar";

const FALLBACK_USER_ID = "D7LkIIiFNKh6aymyFtoBRRZ7vxz1"; // dev fallback when no user is signed in (mock mode)

/** Static empty-state suggestions — used until the analytics fetch answers (or if it fails). */
const DEFAULT_SUGGESTIONS = [
  "Can you look for studies about gamification?",
  "Can you look for related studies about IoT-based smart irrigation?",
  "Can you look for studies about student benefits on cloud platforms?",
];

/** Follow-up sent by the "Expand" button — the agent blends context into it. */
const EXPAND_PROMPT = "Expand your previous answer with more detail and examples.";

/** Prefers the server-provided message (rate limit, breaker, etc.) over a generic fallback. */
function toUserFacingError(err: unknown): string {
  if (err instanceof Error && err.message && !err.message.startsWith("Request failed with status code")) {
    return err.message;
  }
  return "MonteAI could not generate a response. Please try again.";
}

interface ChatPageProps {
  chatService: ChatService;
  /** Existing session to open — messages are fetched lazily on mount. */
  sessionId?: string | null;
  /** Prompt to auto-send once on mount (e.g. navigated from the home page). */
  initialPrompt?: string;
  /** Firebase uid of the signed-in user — used when creating sessions. */
  userId?: string | null;
  /** Notifies the host app that a session was created or received a message (e.g. to refresh a sessions sidebar). */
  onSessionActivity?: () => void;
  /** Called after the current session is deleted so the host can leave its route. */
  onSessionDeleted?: (sessionId: string) => void;
}

export function ChatPage({
  chatService,
  sessionId,
  initialPrompt,
  userId,
  onSessionActivity,
  onSessionDeleted,
}: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionId);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  /** Id of the assistant bubble currently being streamed into (drives the typing cursor). */
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  /** Latest progress note from the agent ("Searching the repository…"), shown while waiting. */
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  /** Terminal send failure, shown as a banner until the next send. */
  const [sendError, setSendError] = useState<string | null>(null);
  /** Id of the assistant message the user cancelled (renders a "Stopped" chip). */
  const [stoppedMessageId, setStoppedMessageId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Empty-state suggestion cards — top analytics queries, static fallback until they load. */
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  /** 3D avatar — what it is doing (idle/thinking/speaking). */
  const [avatarActivity, setAvatarActivity] = useState<AvatarActivity>("idle");
  /** 3D avatar — mood from the latest answer (cheerful when theses matched). */
  const [avatarEmotion, setAvatarEmotion] = useState<AvatarEmotion>("neutral");
  /** Incremented once per streamed delta — the avatar's mouth syncs to it. */
  const [avatarPulse, setAvatarPulse] = useState(0);
  const deleteSession = useDeleteChatSession(chatService);
  const hasAutoSent = useRef(false);
  /** AbortController for the in-flight stream; nulled when idle/finished. */
  const abortRef = useRef<AbortController | null>(null);

  // Fetch the top query strings once for the empty-state suggestion cards.
  // Fails soft: the static fallbacks stay in place when the call rejects.
  useEffect(() => {
    let active = true;
    chatService
      .getQuerySuggestions(6)
      .then((list) => {
        if (!active) return;
        const cleaned = (list ?? []).map((s) => s?.trim()).filter(Boolean);
        if (cleaned.length > 0) setSuggestions(cleaned);
      })
      .catch(() => {
        /* keep DEFAULT_SUGGESTIONS */
      });
    return () => {
      active = false;
    };
  }, [chatService]);

  // Fetch the selected session's messages. The API returns them latest-first;
  // reverse so the conversation reads chronologically and the view
  // auto-scrolls to the latest message.
  useEffect(() => {
    if (!sessionId) return;

    let active = true;
    chatService
      .getSession(sessionId)
      .then((session) => {
        if (!active) return;
        setMessages(session ? [...session.messages].reverse() : []);
        // Mood from the newest assistant answer already in the conversation.
        const latestAssistant = (session?.messages ?? [])
          .filter((m) => m.role === "assistant")
          .reduce<ChatMessageResponseDto | null>(
            (newest, m) => (!newest || m.timestamp > newest.timestamp ? m : newest),
            null
          );
        setAvatarEmotion(
          latestAssistant ? (latestAssistant.sources?.length ? "cheerful" : "sad") : "neutral"
        );
      })
      .catch(() => {
        if (active) setMessages([]);
      })
      .finally(() => {
        if (active) setIsLoadingSession(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId, chatService]);

  const send = useCallback(
    async (content: string, options?: { clearInput?: boolean }) => {
      if (!content.trim() || isSending || isLoadingSession) return;
      setIsSending(true);
      if (options?.clearInput !== false) setInput("");
      setSendError(null);
      setStreamStatus("Preparing your question…");
      // Monte ponders while the agent plans/retrieves, talks while tokens stream.
      setAvatarActivity("thinking");
      setAvatarEmotion("neutral");

      // Fresh AbortController for this send — lets the Stop button (or
      // unmount) cancel the in-flight SSE request.
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let activeSessionId = sessionId ?? localSessionId;

        if (!activeSessionId) {
          const session = await chatService.createSession({
            userId: userId ?? FALLBACK_USER_ID,
            title: content.slice(0, 100),
          });
          activeSessionId = session.id;
          setLocalSessionId(session.id);
          onSessionActivity?.();
        }

        const optimisticUser: ChatMessageResponseDto = {
          id: crypto.randomUUID(),
          sessionId: activeSessionId,
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUser]);

        // ── Streaming path ──
        if (typeof chatService.sendMessageStream === "function") {
          const placeholderId = crypto.randomUUID();
          /** True once the first token arrived — later status notes must not revert to "thinking". */
          let sawDelta = false;
          setStreamingAssistantId(placeholderId);
          setMessages((prev) => [
            ...prev,
            {
              id: placeholderId,
              sessionId: activeSessionId,
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
              sources: null,
            },
          ]);

          try {
            const finalMessage = await chatService.sendMessageStream(
              activeSessionId,
              { role: "user", content },
              {
                signal: controller.signal,
                onStatus: (status) => {
                  setStreamStatus(status);
                  if (!sawDelta) setAvatarActivity("thinking");
                },
                onSources: (sources) => {
                  setAvatarEmotion(sources?.length ? "cheerful" : "sad");
                  setMessages((prev) =>
                    prev.map((m) => (m.id === placeholderId ? { ...m, sources } : m))
                  );
                },
                onDelta: (text) => {
                  setStreamStatus(null);
                  if (!sawDelta) {
                    sawDelta = true;
                    setAvatarActivity("speaking");
                  }
                  setAvatarPulse((p) => p + 1);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: m.content + text } : m
                    )
                  );
                },
              }
            );
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? finalMessage : m))
            );
            // Cheerful when the answer cites relevant theses, politely sad when not.
            setAvatarEmotion(finalMessage.sources?.length ? "cheerful" : "sad");
          } catch (err) {
            if (err instanceof ChatStreamAbortedError) {
              // User tapped Stop: keep whatever partial content streamed into
              // the placeholder and tag it with a "Stopped" chip. The server
              // already persisted the partial answer on disconnect.
              setStoppedMessageId(placeholderId);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? { ...m, content: m.content.trimEnd(), sources: m.sources ?? null }
                    : m
                )
              );
            } else {
              // Do NOT fall back to a blocking re-send: the stream endpoint has
              // already persisted the user message, so a retry would duplicate
              // it AND block for the full agent run. Surface the error instead.
              console.error("Chat stream failed:", err);
              setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
              setSendError(toUserFacingError(err));
              setAvatarEmotion("sad");
            }
          } finally {
            setStreamingAssistantId(null);
            setStreamStatus(null);
            setAvatarActivity("idle");
          }
        } else {
          // ── Blocking fallback ──
          const assistantMessage = await chatService.sendMessage(activeSessionId, {
            role: "user",
            content,
          });
          setMessages((prev) => [...prev, assistantMessage]);
          setAvatarEmotion(assistantMessage.sources?.length ? "cheerful" : "sad");
        }

        onSessionActivity?.();
      } catch (err) {
        console.error("Chat send failed:", err);
        setSendError(toUserFacingError(err));
        setAvatarEmotion("sad");
      } finally {
        abortRef.current = null;
        setIsSending(false);
        setStreamStatus(null);
        setAvatarActivity("idle");
      }
    },
    [
      chatService,
      sessionId,
      localSessionId,
      userId,
      onSessionActivity,
      isSending,
      isLoadingSession,
    ]
  );

  const activeSessionId = sessionId ?? localSessionId;

  /** Abort the in-flight stream (the Stop button). */
  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Abort any in-flight stream when the page unmounts so the request (and
  // the server-side agent run) doesn't keep going in the background.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** "Cite" — formats the message's sources as APA 7 references (server-side). */
  const handleRequestCitations = useCallback(
    (sources: ChatSourceDto[]) => chatService.formatCitations(sources),
    [chatService]
  );

  /** "Expand" — sends a context-dependent follow-up asking for more detail. */
  const handleExpand = useCallback(() => {
    send(EXPAND_PROMPT);
  }, [send]);

  /** "Retry" — re-sends a user message's text as a new turn (non-destructive). */
  const handleRetry = useCallback(
    (content: string) => send(content, { clearInput: false }),
    [send]
  );

  const confirmDeleteSession = async () => {
    if (!activeSessionId || deleteSession.isPending) return;

    try {
      await deleteSession.mutateAsync(activeSessionId);
      setConfirmingDelete(false);
      setMessages([]);
      setLocalSessionId(null);
      setAvatarEmotion("neutral");
      onSessionActivity?.();
      onSessionDeleted?.(activeSessionId);
      toast.success("Chat deleted");
    } catch (err) {
      toast.error(toUserFacingError(err));
    }
  };

  // Auto-send initial prompt when navigating from another page.
  // Deferred one task: React StrictMode's mount double-invoke runs all
  // effects, then all cleanups, then effects again. send() assigns
  // abortRef.current synchronously, so starting it inside the first effect
  // pass lets the unmount-abort cleanup below abort the controller before
  // the stream request is even created — axios rejects the pre-aborted
  // signal with a CanceledError, which the UI misreads as a user Stop
  // (empty bubble + "Stopped" chip on the first message of every new chat).
  // The timer fires after the double-invoke, when no cleanup can touch it;
  // a real unmount before then clears it, so no orphan send is possible.
  useEffect(() => {
    if (!initialPrompt || hasAutoSent.current) return;
    const timer = setTimeout(() => {
      hasAutoSent.current = true;
      void send(initialPrompt);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialPrompt, send]);

  if (isLoadingSession) {
    return <ChatPageSkeleton />;
  }

  return (
    <>
      <ChatView
        avatar={<MonteAvatar activity={avatarActivity} emotion={avatarEmotion} pulse={avatarPulse} />}
        messages={messages}
        input={input}
        isSending={isSending}
        streamingMessageId={streamingAssistantId}
        streamStatus={streamStatus}
        stoppedMessageId={stoppedMessageId}
        error={sendError}
        suggestions={suggestions}
        onSelectSuggestion={(text) => send(text)}
        onRequestCitations={handleRequestCitations}
        onExpand={handleExpand}
        onRetry={handleRetry}
        onCancel={cancelStream}
        onDeleteSession={activeSessionId ? () => setConfirmingDelete(true) : undefined}
        isDeletingSession={deleteSession.isPending}
        onInputChange={setInput}
        onSend={() => send(input)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this chat?"
        description="This permanently deletes the conversation and its messages. This action cannot be undone."
        confirmLabel="Delete chat"
        loading={deleteSession.isPending}
        onConfirm={confirmDeleteSession}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
