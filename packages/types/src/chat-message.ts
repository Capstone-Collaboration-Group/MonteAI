export interface CreateChatMessageDto {
  role: string;
  content: string;
}

export interface UpdateChatMessageDto {}

export interface ChatMessageResponseDto {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
}