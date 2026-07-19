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

export class LiveChatService implements ChatService {
  constructor(private readonly client: AxiosInstance) {}

  async createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto> {
    const { data } = await this.client.post<ChatSessionResponseDto>("/chat/sessions", dto);
    return data;
  }

  async getSession(sessionId: string): Promise<ChatSessionResponseDto | null> {
    try {
      const { data } = await this.client.get<ChatSessionResponseDto>(`/chatsessions/${sessionId}`);
      return data;
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async updateChatSession(sessionId: string, dto: UpdateChatSessionDto): Promise<boolean> { 
    try { 
      const { data } = await this.client.patch<boolean>(`/chat/session/${sessionId}`, dto);
      return data;
    } catch (err: unknown) { 
      if (isAxiosError(err) && err.response?.status === 404) {
        return false;
      }
      throw err;
    }
  }

  async sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto> {
    const { data } = await this.client.post<ChatMessageResponseDto>(
      `/chatsessions/${sessionId}/messages`,
      dto
    );
    return data;
  }
}