// lib/chat/index.ts
import { mockChatService } from "./mockChatService";
import { liveChatService } from "./liveChatService";

export const chatService =
  import.meta.env.VITE_USE_MOCK_CHAT === "true" ? mockChatService : liveChatService;

export type { ChatService } from "./types";
export type {
  CreateChatSessionDto,
  ChatSessionResponseDto,
  CreateChatMessageDto,
  ChatMessageResponseDto,
} from "@monteai/types";