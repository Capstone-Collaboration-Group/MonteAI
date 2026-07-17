// packages/hooks/src/chat/useChat.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateChatSessionDto,
  CreateChatMessageDto,
} from "@monteai/types";
import type { ChatService } from "@monteai/api"

export const chatKeys = {
  session: (sessionId: string) => ["chatSession", sessionId] as const,
};

export function useChatSession(chatService: ChatService, sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? chatKeys.session(sessionId) : ["chatSession", "none"],
    queryFn: () => chatService.getSession(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useCreateChatSession(chatService: ChatService) {
  return useMutation({
    mutationFn: (dto: CreateChatSessionDto) => chatService.createSession(dto),
  });
}

export function useSendChatMessage(chatService: ChatService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, dto }: { sessionId: string; dto: CreateChatMessageDto }) =>
      chatService.sendMessage(sessionId, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.session(variables.sessionId) });
    },
  });
}