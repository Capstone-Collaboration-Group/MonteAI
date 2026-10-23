// packages/api/src/chat/chatService.ts
//
// Live chat service — REST for sessions/history, plus an SSE client for the
// streaming agent endpoint.
//
// STREAMING DATA FLOW (sendMessageStream):
//   POST /chat/sessions/{id}/messages/stream (text/event-stream)
//     event: status   data: { "message": "Searching the repository…" }
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

import { isAxiosError, isCancel, type AxiosInstance, type AxiosProgressEvent } from "axios";
import type {
  ChatSessionResponseDto,
  ChatSessionResponseListDto,
  CreateChatSessionDto,
  CreateChatMessageDto,
  UpdateChatSessionDto,
  ChatMessageResponseDto,
  ChatSourceDto,
  ApaCitationDto,
  ApaCitationResponseDto,
  AnalyticsSuggestionsDto,
} from "@monteai/types";
import type { ChatService, ChatStreamHandlers } from "./types";
import { ChatStreamAbortedError } from "./errors";
import { handle404 } from "@monteai/utils";

/** Shape of the SSE "done" event payload. */
interface DoneEvent {
  message: ChatMessageResponseDto;
}

/** Shape of the SSE "status" event payload. */
interface StatusEvent {
  message: string;
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

  /**
   * Translates an axios failure into an Error carrying a user-friendly,
   * server-provided message when available (circuit-breaker 503s, validation
   * 400s) instead of axios's generic "Request failed with status code N".
   */
  private static toFriendlyError(err: unknown): Error {
    if (isAxiosError(err)) {
      const body = err.response?.data as { message?: unknown } | undefined;
      if (typeof body?.message === "string" && body.message.length > 0) {
        return new Error(body.message);
      }
      if (err.response?.status === 429) {
        return new Error("You're sending messages too quickly. Please wait a moment and try again.");
      }
    }
    return err instanceof Error ? err : new Error("Request failed.");
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
    try {
      const { data } = await this.client.post<
        { message: string; userMessage: ChatMessageResponseDto; aiMessage: ChatMessageResponseDto }
      >(
        `/chat/sessions/${sessionId}/messages`,
        dto,
        { timeout: 120_000 }
      );
      return data.aiMessage;
    } catch (err) {
      throw LiveChatService.toFriendlyError(err);
    }
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
          if (eventName === "status") {
            handlers.onStatus?.((JSON.parse(rawData) as StatusEvent).message);
          } else if (eventName === "sources") {
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

    let data: string;
    try {
      const response = await this.client.post<string>(
        `/chat/sessions/${sessionId}/messages/stream`,
        dto,
        {
          // Agent planning runs before the first token — disable axios's
          // default 10s timeout for this request.
          timeout: 0,
          responseType: "text",
          // Caller-provided AbortSignal lets the UI cancel mid-stream (Stop
          // button). Axios rejects with a CanceledError when it fires.
          signal: handlers.signal,
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
      data = response.data;
    } catch (err) {
      // Caller aborted via the AbortSignal (Stop button / unmount). The
      // server has already persisted whatever partial answer it generated,
      // so surface a dedicated error the UI can recognize (and NOT show as
      // a failure).
      if (isCancel(err) || (err instanceof Error && err.name === "CanceledError")) {
        throw new ChatStreamAbortedError();
      }
      // Pre-stream failures (429 rate limit, 503 breaker, ownership 403/404).
      throw LiveChatService.toFriendlyError(err);
    }

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
      await this.client.put(`/chat/sessions/${sessionId}/update`, dto);
      return true;
    } catch (err) {
      return handle404(err, false)
    }
  }

  async setSessionPinned(sessionId: string, pinned: boolean): Promise<boolean> {
    try {
      await this.client.put(`/chat/sessions/${sessionId}/pin`, { pinned });
      return true;
    } catch (err) {
      throw LiveChatService.toFriendlyError(err);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.client.delete(`/chat/sessions/${sessionId}/delete`);
    } catch (err) {
      throw LiveChatService.toFriendlyError(err);
    }
  }

  /**
   * Top query strings from the analytics store. Kept tolerant: a failed
   * fetch returns [] so chat surfaces fall back to their static prompts
   * instead of showing an error for a decorative feature.
   */
  async getQuerySuggestions(limit = 6): Promise<string[]> {
    try {
      const { data } = await this.client.get<AnalyticsSuggestionsDto>(
        "/analytics/suggestions",
        { params: { limit } }
      );
      return data?.suggestions ?? [];
    } catch {
      return [];
    }
  }

  async formatCitations(sources: ChatSourceDto[]): Promise<ApaCitationDto[]> {
    if (!sources.length) return [];
    try {
      const { data } = await this.client.post<ApaCitationResponseDto>(
        "/chat/citations/apa",
        { sources }
      );
      return data?.citations ?? [];
    } catch (err) {
      throw LiveChatService.toFriendlyError(err);
    }
  }
}
