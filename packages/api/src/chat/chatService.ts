// packages/api/src/chat/chatService.ts
//
// Live chat service — REST for sessions/history, plus an SSE client for the
// streaming agent endpoint.
//
// STREAMING DATA FLOW (sendMessageStream):
//   POST /chat/sessions/{id}/messages/stream (text/event-stream)
//     event: sources  data: [ { thesisId, title, authors, ... } ]
//     event: delta    data: { "text": "...fragment..." }
//     event: done     data: { "message": { persisted assistant message } }
//     event: error    data: { "message": "..." }
//
// The request goes through the shared axios instance so the auth interceptor
// (Firebase token) and 401-refresh logic apply. SSE frames are read
// incrementally from the underlying XHR via onDownloadProgress — the
// accumulated responseText is split into complete "event: ...\ndata: ...\n\n"
// frames as they arrive, so tokens render as they are generated.

import { type AxiosInstance, type AxiosProgressEvent } from "axios";
import type {
  ChatSessionResponseDto,
  ChatSessionResponseListDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  UpdateChatSessionDto,
  ChatMessageResponseDto,
  ChatSourceDto,
} from "@monteai/types";
import type { ChatService, ChatStreamHandlers } from "./types";
import { handle404 } from "@monteai/utils";

/** Shape of the SSE "done" event payload. */
interface DoneEvent {
  message: ChatMessageResponseDto;
}

/** Shape of the SSE "delta" event payload. */
interface DeltaEvent {
  text: string;
}

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

  /**
   * Blocking send. Kept for callers that cannot consume streams (and as the
   * fallback when streaming fails mid-request). The timeout is raised because
   * the server runs a multi-step agent before answering.
   */
  async sendMessage(sessionId: string, dto: CreateChatMessageDto): Promise<ChatMessageResponseDto> {
    const { data } = await this.client.post<
      { message: string; userMessage: ChatMessageResponseDto; aiMessage: ChatMessageResponseDto }
    >(
      `/chat/sessions/${sessionId}/messages`,
      dto,
      { timeout: 120_000 }
    );
    return data.aiMessage;
  }

  async sendMessageStream(
    sessionId: string,
    dto: CreateChatMessageDto,
    handlers: ChatStreamHandlers = {}
  ): Promise<ChatMessageResponseDto> {
    let consumed = 0;
    let finalMessage: ChatMessageResponseDto | null = null;
    let streamError: string | null = null;

    const consumeBuffer = (fullText: string) => {
      // Only complete frames (terminated by a blank line) are parsed; a
      // partial trailing frame is left for the next progress tick.
      const unprocessed = fullText.slice(consumed);
      const boundary = unprocessed.lastIndexOf("\n\n");
      if (boundary === -1) return;

      const frames = unprocessed.slice(0, boundary).split("\n\n");
      consumed += boundary + 2;

      for (const frame of frames) {
        const eventName = this.readSseField(frame, "event");
        const rawData = this.readSseField(frame, "data");
        if (!eventName || rawData === null) continue;

        try {
          if (eventName === "sources") {
            handlers.onSources?.(JSON.parse(rawData) as ChatSourceDto[]);
          } else if (eventName === "delta") {
            handlers.onDelta?.((JSON.parse(rawData) as DeltaEvent).text);
          } else if (eventName === "done") {
            finalMessage = (JSON.parse(rawData) as DoneEvent).message;
          } else if (eventName === "error") {
            streamError = (JSON.parse(rawData) as { message?: string }).message ?? "MonteAI could not generate a response.";
          }
        } catch {
          // Ignore malformed frames rather than killing the stream.
        }
      }
    };

    const { data } = await this.client.post<string>(
      `/chat/sessions/${sessionId}/messages/stream`,
      dto,
      {
        // Agent planning runs before the first token — disable axios's
        // default 10s timeout for this request.
        timeout: 0,
        responseType: "text",
        onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
          const xhr = (progressEvent.event as ProgressEvent | undefined)?.target as
            | XMLHttpRequest
            | undefined
            | null;
          // In browsers, the raw XHR exposes everything received so far.
          if (xhr && typeof xhr.responseText === "string") {
            consumeBuffer(xhr.responseText);
          }
        },
      }
    );

    // Flush any trailing frame that never hit a progress tick.
    if (typeof data === "string") {
      consumeBuffer(data + "\n\n");
    }

    if (streamError) {
      throw new Error(streamError);
    }
    if (!finalMessage) {
      throw new Error("Streaming response ended without a completed message.");
    }
    return finalMessage;
  }

  /** Reads one "field: value" line from an SSE frame (data lines are joined). */
  private readSseField(frame: string, field: string): string | null {
    const lines = frame.split("\n");
    const matches = lines
      .filter((line) => line.startsWith(`${field}:`))
      .map((line) => line.slice(field.length + 1).replace(/^ /, ""));
    if (matches.length === 0) return null;
    return matches.join("\n");
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
