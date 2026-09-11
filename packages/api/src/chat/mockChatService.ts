// packages/api/src/chat/mockChatService.ts

import type { ChatService } from "./types";
import type {
  ChatSessionResponseDto,
  ChatSessionResponseListDto,
  ChatMessageResponseDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  UpdateChatSessionDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockChatService loaded — Initialized with seed data");

function buildSeed(): ChatSessionResponseDto[] {
  return [
    {
      id: "session-1",
      userId: "user-1",
      title: "Getting Started",
      createdAt: "2025-01-10T08:00:00.000Z",
      lastChatDate: "2025-01-10T08:15:00.000Z",
      messages: [
        {
          id: "message-1",
          sessionId: "session-1",
          role: "user",
          content: "Hello!",
          timestamp: "2025-01-10T08:00:00.000Z",
        },
        {
          id: "message-2",
          sessionId: "session-1",
          role: "assistant",
          content: "Hi! How can I help you today?",
          timestamp: "2025-01-10T08:00:05.000Z",
        },
      ],
    },
    {
      id: "session-2",
      userId: "user-2",
      title: "Research Assistance",
      createdAt: "2025-02-01T09:30:00.000Z",
      lastChatDate: "2025-02-01T09:35:00.000Z",
      messages: [
        {
          id: "message-3",
          sessionId: "session-2",
          role: "user",
          content: "Can you help me with my thesis?",
          timestamp: "2025-02-01T09:30:00.000Z",
        },
      ],
    },
  ];
}

const sessionsMap = new Map<string, ChatSessionResponseDto>();

buildSeed().forEach((session) => sessionsMap.set(session.id, session));

export const mockChatService: ChatService = {
  async getSessions(userId: string): Promise<ChatSessionResponseListDto> {
    await delay(150);

    return [...sessionsMap.values()]
      .filter((session) => session.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.lastChatDate).getTime() - new Date(a.lastChatDate).getTime()
      );
  },

  async createSession(dto: CreateChatSessionDto) {
    await delay(300);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const session: ChatSessionResponseDto = {
      id,
      userId: dto.userId,
      title: dto.title,
      createdAt: now,
      lastChatDate: now,
      messages: [],
    };

    sessionsMap.set(id, session);

    return session;
  },

  async getSession(sessionId: string) {
    await delay(150);

    return sessionsMap.get(sessionId) ?? null;
  },

  async updateChatSession(
    sessionId: string,
    dto: UpdateChatSessionDto
  ) {
    await delay(300);

    const existing = sessionsMap.get(sessionId);

    if (!existing) {
      return false;
    }

    sessionsMap.set(sessionId, {
      ...existing,
      title: dto.title,
    });

    return true;
  },

  async sendMessage(
    sessionId: string,
    dto: CreateChatMessageDto
  ): Promise<ChatMessageResponseDto> {
    await delay(600);

    const session = sessionsMap.get(sessionId);

    if (!session) {
      throw new Error(`Chat session '${sessionId}' not found.`);
    }

    const now = new Date().toISOString();

    const userMessage: ChatMessageResponseDto = {
      id: crypto.randomUUID(),
      sessionId,
      role: dto.role,
      content: dto.content,
      timestamp: now,
    };

    const assistantMessage: ChatMessageResponseDto = {
      id: crypto.randomUUID(),
      sessionId,
      role: "assistant",
      content: `Here is a summary of the sources relevant to "${dto.content.slice(0, 80)}" (Dela Cruz et al., 2024). This is a mock MonteAI response for local development.`,
      timestamp: now,
    };

    session.messages.push(userMessage, assistantMessage);

    session.lastChatDate = assistantMessage.timestamp;

    sessionsMap.set(sessionId, session);

    return assistantMessage;
  },
};