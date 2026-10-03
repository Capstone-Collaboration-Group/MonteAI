import { isAxiosError } from "axios";

/**
 * Best-effort human-readable message from an API error.
 * Prefers the server's `message` body (e.g. schedule conflict rejections)
 * and falls back to the caller's default for network/validation errors.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: unknown; Message?: unknown }
      | undefined;
    const message = data?.message ?? data?.Message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}
