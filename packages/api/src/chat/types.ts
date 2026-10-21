// packages/api/src/chat/types.ts
import type {
  CreateChatSessionDto,
  ChatSessionResponseDto,
  ChatSessionResponseListDto,
  CreateChatMessageDto,
  ChatMessageResponseDto,
  ChatSourceDto,
  UpdateChatSessionDto,
} from "@monteai/types";

/**
 * Callbacks for the streaming chat endpoint (SSE).
 * Event order per message: onStatus* -> onSources (once) -> onStatus -> onDelta* -> done.
 */
export interface ChatStreamHandlers {
  /** Fired with a progress note ("Searching the repository…") while the agent plans/retrieves, before and between answer tokens. */
  onStatus?: (message: string) => void;
  /** Fired when the agent finishes retrieval, before the first answer token. */
  onSources?: (sources: ChatSourceDto[]) => void;
  /** Fired for each fragment of the generated answer. */
  onDelta?: (text: string) => void;
}

export interface ChatService {
  getSessions(userId: string): Promise<ChatSessionResponseListDto>;
  createSession(dto: CreateChatSessionDto): Promise<ChatSessionResponseDto>;
  getSession(sessionId: string): Promise<ChatSessionResponseDto | null>;
  updateChatSession(sessionId: string, dto: UpdateChatSessionDto ): Promise<boolean>;
  setSessionPinned(sessionId: string, pinned: boolean): Promise<boolean>;
  deleteSession(sessionId: string): Promise<void>;
  sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto>;
  /**
   * Streams a message through the SSE endpoint. Resolves with the final,
   * persisted assistant message (identical shape to sendMessage) once the
   * stream completes.
   */
  sendMessageStream(
    sessionId: string,
    dto: CreateChatMessageDto,
    handlers?: ChatStreamHandlers
  ): Promise<ChatMessageResponseDto>;
}
