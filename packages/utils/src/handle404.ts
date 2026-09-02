import { isAxiosError } from 'axios';

export function handle404<T>(err: unknown, fallback: T): T {
  if (isAxiosError(err) && err.response?.status === 404) {
    return fallback;
  }
  throw err;
}
