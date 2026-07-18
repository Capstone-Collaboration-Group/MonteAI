// packages/api/src/chat/liveChatService.ts
import { isAxiosError, type AxiosInstance } from "axios";
import type {
  ChatSessionResponseDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  UpdateChatSessionDto,
  ChatMessageResponseDto,
} from "@monteai/types";
import type { ChatService } from "./types";

export function createLiveChatService(client: AxiosInstance): ChatService {
  return {
    async createSession(dto: CreateChatSessionDto) {
      const { data } = await client.post<ChatSessionResponseDto>("/api/chat/sessions", dto);
      return data;
    },

    async getSession(sessionId: string) {
      try {
        const { data } = await client.get<ChatSessionResponseDto>(`/api/v1/chatsessions/${sessionId}`);
        return data;
      } catch (err: unknown) {
        if (isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    async updateChatSession(sessionId: string, dto: UpdateChatSessionDto) { 
      try { 
        const {data } = await client.patch<boolean>(`/api/v1/chat/session/${sessionId}`, dto);
        return data;
      } catch(err: unknown) { 
        if(isAxiosError(err) && err.response?.status === 404) return false;
        throw err;
      }
    },

    async sendMessage(sessionId: string, dto: CreateChatMessageDto) {
      const { data } = await client.post<ChatMessageResponseDto>(
        `/api/v1/chatsessions/${sessionId}/messages`,
        dto
      );
      return data;
    },
  };
}