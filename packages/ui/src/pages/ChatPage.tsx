// packages/ui/src/pages/ChatPage.tsx
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { ChatService } from "@monteai/api";
import type { ChatMessageResponseDto } from "@monteai/types";
import { ChatView } from "../components/Chat/ChatView";

const MOCK_USER_ID = "D7LkIIiFNKh6aymyFtoBRRZ7vxz1"; // TODO: replace with real useAuth()

interface ChatPageProps {
  chatService: ChatService;
}

export function ChatPage({ chatService }: ChatPageProps) {
  const location = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const hasAutoSent = useRef(false);

  const send = async (content: string) => {
    if (!content.trim() || isSending) return;
    setIsSending(true);
    setInput("");

    try {
      let activeSessionId = sessionId;

      if (!activeSessionId) {
        const session = await chatService.createSession({
          userId: MOCK_USER_ID,
          title: content.slice(0, 100),
        });
        activeSessionId = session.id;
        setSessionId(session.id);
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
      console.log("assistantMessage returned:", assistantMessage);
console.log("role:", assistantMessage?.role);
console.log("content:", assistantMessage?.content);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat send failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Auto-send initial prompt when navigating from another page
  useEffect(() => {
    const initialPrompt =
      (location.state as { initialPrompt?: string } | null)?.initialPrompt;
    if (initialPrompt && !hasAutoSent.current) {
      hasAutoSent.current = true;
      send(initialPrompt);
    }
  }, [location.state]);

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