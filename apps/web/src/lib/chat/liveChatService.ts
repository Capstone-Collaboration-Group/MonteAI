// lib/chat/liveChatService.ts
import type {
  ChatSessionResponseDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  ChatMessageResponseDto,
} from "@monteai/types";
import type { ChatService } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const liveChatService: ChatService = {
  async createSession(dto: CreateChatSessionDto) {
    const res = await fetch(`${API_BASE}/api/chatsessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json() as Promise<ChatSessionResponseDto>;
  },

  async getSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/api/chatsessions/${sessionId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to fetch session");
    return res.json() as Promise<ChatSessionResponseDto>;
  },

  async sendMessage(sessionId: string, dto: CreateChatMessageDto) {
    const res = await fetch(`${API_BASE}/api/chatsessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) throw new Error("Failed to send message");
    return res.json() as Promise<ChatMessageResponseDto>;
  },
};