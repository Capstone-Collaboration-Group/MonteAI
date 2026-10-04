import { isAxiosError } from "axios";

/**
 * Best-effort human-readable message from an API error.
 * Prefers the server's `message`/`Message` body (e.g. schedule conflict
 * rejections), then a plain-text body (`BadRequest("File is required")`),
 * then a default for bare 403s, and falls back to the caller's default for
 * network/validation errors.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data;

    if (typeof data === "string" && data.trim()) return data.trim();

    if (data && typeof data === "object") {
      const body = data as { message?: unknown; Message?: unknown };
      const message = body.message ?? body.Message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }

    if (err.response?.status === 403) {
      return "You are not allowed to perform this action.";
    }
  }
  return fallback;
}
