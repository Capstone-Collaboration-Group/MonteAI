import { createUserService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const userService = createUserService(
    apiClient,
    import.meta.env.VITE_USE_MOCK === "true"
);
