// packages/hooks/src/chat/useChat.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateChatSessionDto,
  CreateChatMessageDto,
} from "@monteai/types";
import type { ChatService } from "@monteai/api"

export const chatKeys = {
  /** Prefix shared by every chat-sessions list query. */
  all: ["chatSessions"] as const,
  /** A user's sessions, sorted latest-first. */
  sessions: (userId: string) => [...chatKeys.all, userId] as const,
  /** A single session with its messages. */
  session: (sessionId: string) => ["chatSession", sessionId] as const,
};

export function useChatSessions(chatService: ChatService, userId: string | null | undefined) {
  return useQuery({
    queryKey: chatKeys.sessions(userId ?? ""),
    queryFn: () => chatService.getSessions(userId as string),
    enabled: !!userId,
  });
}

export function useChatSession(chatService: ChatService, sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? chatKeys.session(sessionId) : ["chatSession", "none"],
    queryFn: () => chatService.getSession(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useCreateChatSession(chatService: ChatService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateChatSessionDto) => chatService.createSession(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useSendChatMessage(chatService: ChatService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, dto }: { sessionId: string; dto: CreateChatMessageDto }) =>
      chatService.sendMessage(sessionId, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.session(variables.sessionId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}
