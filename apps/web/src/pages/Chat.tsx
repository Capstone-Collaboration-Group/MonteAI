import { ChatPage } from "@monteai/ui";
import { chatService } from "../lib/chat/chatService";

export default function Chat() { 
  return <ChatPage chatService={chatService} />
}