import type { 
    ChatSessionResponseDto,
    ChatMessageResponseDto,
    CreateChatSessionDto,
    CreateChatMessageDto
} from "@monteai/types";

import type { ChatService } from "./types";

const sessions = new Map<string, ChatSessionResponseDto>();

const mockReplies = [
  "Based on recent theses in your database, here are a few relevant papers on that topic...",
  "That's a great research question. Let me break down what I found in the thesis repository.",
  "Here's a summary of related literature that might help with your section.",
  "I found 3 theses that discuss this. Would you like me to compare their methodologies?",
];

function delay(ms: number) { 
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockChatService: ChatService = {
    async createSession(dto: CreateChatSessionDto) { 
        await delay(300);
        const now = new Date().toISOString();
        const session: ChatSessionResponseDto = { 
            id: crypto.randomUUID(),
            userId: dto.userId,
            title: dto.title,
            createdAt: now,
            lastChatDate: now,
            messages: [],
        };
        sessions.set(session.id, session);
        return session;
    },
    async getSession(sessionId: string) { 
        await delay(200);
        return sessions.get(sessionId) ?? null;
    },
    async sendMessage(sessionId: string, dto: CreateChatMessageDto) { 
        const session = sessions.get(sessionId);
        if(!session) throw new Error(`Session ${sessionId} not found`);
      
        await delay(200);
        const userMessage: ChatMessageResponseDto = { 
        id: crypto.randomUUID(),
        sessionId,
        role: dto.role,
        content: dto.content,
        timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);
    await delay(600 + Math.random() * 600);
    const assistantMessage: ChatMessageResponseDto = { 
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        content: mockReplies[Math.floor(Math.random() * mockReplies.length)],
        timestamp: new Date().toISOString(),
    };
    session.messages.push(assistantMessage);
    session.lastChatDate = assistantMessage.timestamp;
    return assistantMessage    
}
  
}
