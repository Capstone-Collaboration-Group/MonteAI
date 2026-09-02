// packages/api/src/chat/types.ts
import type {
  CreateChatSessionDto,
  ChatSessionResponseDto,
  CreateChatMessageDto,
  ChatMessageResponseDto,
  UpdateChatSessionDto,
} from "@monteai/types";

export interface ChatService {
  createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto>;
  getSession(sessionId: string): Promise<ChatSessionResponseDto | null>;
  updateChatSession(sessionId: string, dto: UpdateChatSessionDto ): Promise<boolean>;
  sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto>;
}