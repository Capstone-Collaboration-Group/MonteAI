// pages/Chat.tsx
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUp, Loader2 } from "lucide-react";
import { chatService, type ChatMessageResponseDto } from "../lib/chat";

const MOCK_USER_ID = "mock-user-id"; // TODO: replace with real useAuth() once wired up

export default function Chat() {
  const location = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
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
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat send failed:", err);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt;
    if (initialPrompt && !hasAutoSent.current) {
      hasAutoSent.current = true;
      send(initialPrompt);
    }
  }, [location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> MonteAI is thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
  onSubmit={(e) => { e.preventDefault(); send(input); }}
  className="border-t border-outline-variant bg-surface-container-low px-6 py-4"
>
  <div className="relative mx-auto max-w-2xl">
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
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
      <div className="text-center mb-5">MonteAi can make mistakes, always double check the output</div>
    </div>
  );
}