import { createChatService } from "@monteai/api";
import { apiClient } from "../firebaseServices";

export const chatService = createChatService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
)