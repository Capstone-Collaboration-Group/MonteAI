import type {
    CreateChatSessionDto,
    ChatSessionResponseDto,
    CreateChatMessageDto,
    ChatMessageResponseDto
} from "@monteai/types";

export interface ChatService { 
    createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto>;
    getSession(sessionId: string): Promise<ChatSessionResponseDto | null>;
    sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto>;
}
