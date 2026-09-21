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
import { ChatView } from "../components/Chat/ChatView";
import { ChatPageSkeleton } from "../components/Chat/skeletons";

const FALLBACK_USER_ID = "D7LkIIiFNKh6aymyFtoBRRZ7vxz1"; // dev fallback when no user is signed in (mock mode)

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
}

export function ChatPage({
  chatService,
  sessionId,
  initialPrompt,
  userId,
  onSessionActivity,
}: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionId);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  /** Id of the assistant bubble currently being streamed into (drives the typing cursor). */
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
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
                onSources: (sources) =>
                  setMessages((prev) =>
                    prev.map((m) => (m.id === placeholderId ? { ...m, sources } : m))
                  ),
                onDelta: (text) =>
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: m.content + text } : m
                    )
                  ),
              }
            );
            setMessages((prev) =>
              prev.map((m) => (m.id === placeholderId ? finalMessage : m))
            );
          } catch (err) {
            console.error("Chat stream failed, falling back to blocking send:", err);
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
            const assistantMessage = await chatService.sendMessage(activeSessionId, {
              role: "user",
              content,
            });
            setMessages((prev) => [...prev, assistantMessage]);
          } finally {
            setStreamingAssistantId(null);
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
      } finally {
        setIsSending(false);
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
    <ChatView
      messages={messages}
      input={input}
      isSending={isSending}
      streamingMessageId={streamingAssistantId}
      onInputChange={setInput}
      onSend={() => send(input)}
    />
  );
}
