import type { AxiosInstance } from "axios";
import { mockChatService } from "./mockChatService";
import { LiveChatService } from "./chatService";
import type { ChatService } from "./types";

export function createChatService(
    client: AxiosInstance,
    useMock: boolean
): ChatService  {
    return useMock ? mockChatService : new LiveChatService(client)
}
export type { ChatService } from "./types";
export  { mockChatService } from "./mockChatService";
export { LiveChatService } from "./chatService";