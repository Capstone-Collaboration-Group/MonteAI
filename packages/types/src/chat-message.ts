export interface CreateChatMessageDto {
  role: string;
  content: string;
}

export interface UpdateChatMessageDto {
  content?: string;
}

export interface ChatMessageResponseDto {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
}

export type ChatMessageResponseListDto = ChatMessageResponseDto[];