import type { ChatMessageResponseDto } from "./chat-message";

export interface CreateChatSessionDto {
  userId: string;
  title: string;
}

export interface UpdateChatSessionDto {
  title: string;
}

export interface ChatSessionResponseDto {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  lastChatDate: string;
  messages: ChatMessageResponseDto[];
}

export type ChatSessionResponseListDto = ChatSessionResponseDto[];
