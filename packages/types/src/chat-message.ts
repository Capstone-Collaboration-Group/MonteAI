// packages/types/src/chat-message.ts
//
// Chat message contracts shared by every frontend (web/desktop).
//
// Assistant messages now carry `sources`: the structured citations produced
// by the server-side agent (see server/Services/AI/MonteAiAgentService.cs).
// The UI renders these as the "Sources" panel under each MonteAI answer.

/** One cited thesis attached to an assistant message. */
export interface ChatSourceDto {
  /** Azure SQL id of the thesis — links to /thesis/view/:thesisId on the web. */
  thesisId?: string | null;
  title?: string | null;
  authors?: string | null;
  publicationYear?: string | null;
  /** Retrieved excerpt that grounded the answer. */
  snippet?: string | null;
  /** Cosine similarity (0-1) for semantic matches; null for keyword matches. */
  score?: number | null;
  /** Blob path of the thesis PDF (not a direct download link). */
  url?: string | null;
}

export interface CreateChatMessageDto {
  role: string;
  content: string;
}

export interface UpdateChatMessageDto {
  content?: string;
}

export interface ChatMessageResponseDto {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
  /** Present on assistant messages produced by the agent; null on user messages and legacy messages. */
  sources?: ChatSourceDto[] | null;
}

export type ChatMessageResponseListDto = ChatMessageResponseDto[];
