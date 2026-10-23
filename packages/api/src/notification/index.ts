import type { AxiosInstance } from "axios";
import { mockNotificationService } from "./mockNotificationService";
import { LiveNotificationService } from "./notificationService";
import type { NotificationService } from "./types";

export function createNotificationService(
    client: AxiosInstance,
    useMock: boolean
): NotificationService {
    return useMock ? mockNotificationService : new LiveNotificationService(client);
}
export type { NotificationService } from "./types";
export { mockNotificationService } from "./mockNotificationService";
export { LiveNotificationService } from "./notificationService";
