// packages/ui/src/pages/ChatPage.tsx
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

        const assistantMessage = await chatService.sendMessage(activeSessionId, {
          role: "user",
          content,
        });
        setMessages((prev) => [...prev, assistantMessage]);
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
      onInputChange={setInput}
      onSend={() => send(input)}
    />
  );
}
