// packages/api/src/chat/liveChatService.ts
import { type AxiosInstance } from "axios";
import type {
  ChatSessionResponseDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  UpdateChatSessionDto,
  ChatMessageResponseDto,
} from "@monteai/types";
import type { ChatService } from "./types";
import { handle404 } from "@monteai/utils";

export class LiveChatService implements ChatService {
  private readonly client: AxiosInstance;
  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto> {
    const { data } = await this.client.post<ChatSessionResponseDto>("/chat/sessions/create", dto);
    return data;
  }
  async sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto> {
      const { data } = await this.client.post<{message: string; useMessage: ChatMessageResponseDto; aiMessage: ChatMessageResponseDto;}>(
      `/chat/sessions/${sessionId}/messages`,
      dto
    );
    return data.aiMessage;
  }
  async getSession(sessionId: string): Promise<ChatSessionResponseDto | null> {
    try {
      const { data } = await this.client.get<ChatSessionResponseDto>(`/chat/sessions/${sessionId}`);
      return data;
    } catch (err) { 
     return handle404(err,  null);
    }
  }

  async updateChatSession(sessionId: string, dto: UpdateChatSessionDto): Promise<boolean> { 
    try { 
      const { data } = await this.client.put<boolean>(`/chat/sessions/${sessionId}/update`, dto);
      return data;
    } catch (err) { 
      return handle404(err, false)
    }
  }
}