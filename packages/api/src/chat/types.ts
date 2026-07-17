// packages/api/src/chat/types.ts
import type {
  CreateChatSessionDto,
  ChatSessionResponseDto,
  CreateChatMessageDto,
  ChatMessageResponseDto,
} from "../../../types";

export interface ChatService {
  createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto>;
  getSession(sessionId: string): Promise<ChatSessionResponseDto | null>;
  sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto>;
}