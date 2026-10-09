import { useParams, useLocation } from "react-router-dom";
import { ChatPage } from "@monteai/ui";
import { useAuth, useQueryClient, chatKeys } from "@monteai/hooks";
import { chatService } from "../lib/chat/chatService";

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const initialPrompt = (location.state as { initialPrompt?: string } | null)
    ?.initialPrompt;

  return (
    <ChatPage
      key={sessionId ?? "new"}
      chatService={chatService}
      sessionId={sessionId ?? null}
      initialPrompt={initialPrompt}
      userId={user?.uid}
      onSessionActivity={() =>
        queryClient.invalidateQueries({ queryKey: chatKeys.all })
      }
    />
  );
}
