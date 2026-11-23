// packages/api/src/chat/errors.ts
//
// Thrown by sendMessageStream when the caller aborts the request via the
// handlers' AbortSignal (user tapped Stop / navigated away). The server
// already persists whatever partial answer was generated when the HTTP
// connection drops, so callers should keep the partial content and must
// NOT treat this as a failure (no error banner, no blocking re-send).

export class ChatStreamAbortedError extends Error {
  constructor(message = "Generation stopped.") {
    super(message);
    this.name = "ChatStreamAbortedError";
  }
}
