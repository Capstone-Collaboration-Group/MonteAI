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
import type { ChatMessageResponseDto } from "@monteai/types";
import { useDeleteChatSession } from "@monteai/hooks";
import { ChatView } from "../components/Chat/ChatView";
import { ChatPageSkeleton } from "../components/Chat/skeletons";
import { ConfirmDialog } from "../components/common";
import { toast } from "../components/Toaster";

const FALLBACK_USER_ID = "D7LkIIiFNKh6aymyFtoBRRZ7vxz1"; // dev fallback when no user is signed in (mock mode)

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteSession = useDeleteChatSession(chatService);
  const hasAutoSent = useRef(false);

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
    async (content: string) => {
      if (!content.trim() || isSending || isLoadingSession) return;
      setIsSending(true);
      setInput("");
      setSendError(null);
      setStreamStatus("Preparing your question…");

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
                onStatus: (status) => setStreamStatus(status),
                onSources: (sources) =>
                  setMessages((prev) =>
                    prev.map((m) => (m.id === placeholderId ? { ...m, sources } : m))
                  ),
                onDelta: (text) => {
                  setStreamStatus(null);
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
          } catch (err) {
            // Do NOT fall back to a blocking re-send: the stream endpoint has
            // already persisted the user message, so a retry would duplicate
            // it AND block for the full agent run. Surface the error instead.
            console.error("Chat stream failed:", err);
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
            setSendError(toUserFacingError(err));
          } finally {
            setStreamingAssistantId(null);
            setStreamStatus(null);
          }
        } else {
          // ── Blocking fallback ──
          const assistantMessage = await chatService.sendMessage(activeSessionId, {
            role: "user",
            content,
          });
          setMessages((prev) => [...prev, assistantMessage]);
        }

        onSessionActivity?.();
      } catch (err) {
        console.error("Chat send failed:", err);
        setSendError(toUserFacingError(err));
      } finally {
        setIsSending(false);
        setStreamStatus(null);
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

  const confirmDeleteSession = async () => {
    if (!activeSessionId || deleteSession.isPending) return;

    try {
      await deleteSession.mutateAsync(activeSessionId);
      setConfirmingDelete(false);
      setMessages([]);
      setLocalSessionId(null);
      onSessionActivity?.();
      onSessionDeleted?.(activeSessionId);
      toast.success("Chat deleted");
    } catch (err) {
      toast.error(toUserFacingError(err));
    }
  };

  // Auto-send initial prompt when navigating from another page
  useEffect(() => {
    if (!initialPrompt || hasAutoSent.current) return;
    hasAutoSent.current = true;
    send(initialPrompt);
  }, [initialPrompt, send]);

  if (isLoadingSession) {
    return <ChatPageSkeleton />;
  }

  return (
    <>
      <ChatView
        messages={messages}
        input={input}
        isSending={isSending}
        streamingMessageId={streamingAssistantId}
        streamStatus={streamStatus}
        error={sendError}
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
