// packages/api/src/chat/liveChatService.ts
import { type AxiosInstance } from "axios";
import type {
  ChatSessionResponseDto,
  ChatSessionResponseListDto,
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

  async getSessions(userId: string): Promise<ChatSessionResponseListDto> {
    try {
      const { data } = await this.client.get<{ message: string; result: ChatSessionResponseListDto }>(
        "/chat/sessions",
        { params: { userId } }
      );
      return [...(data.result ?? [])].sort(
        (a, b) => new Date(b.lastChatDate).getTime() - new Date(a.lastChatDate).getTime()
      );
    } catch (err) {
      return handle404(err, []);
    }
  }

  async createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto> {
    const { data } = await this.client.post<{ message: string; result: ChatSessionResponseDto }>(
      "/chat/sessions/create",
      dto
    );
    return data.result;
  }
  async sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto> {
      const { data } = await this.client.post<{message: string; userMessage: ChatMessageResponseDto; aiMessage: ChatMessageResponseDto;}>(
      `/chat/sessions/${sessionId}/messages`,
      dto
    );
    return data.aiMessage;
  }
  async getSession(sessionId: string): Promise<ChatSessionResponseDto | null> {
    try {
      const { data } = await this.client.get<ChatSessionResponseDto>(`/chat/sessions/${sessionId}`);
      return {
        ...data,
        messages: [...(data.messages ?? [])].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      };
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
