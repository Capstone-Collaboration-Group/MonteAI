    import type { AxiosInstance } from "axios";
    import { mockAnnouncementService } from "./mockAnnouncementService";
    import { LiveAnnouncementService } from "./announcementService";
    import type { AnnouncementService } from "./types";

    export function createAnnouncementService(
        client: AxiosInstance,
        useMock: boolean
    ): AnnouncementService  {
        return useMock ? mockAnnouncementService : new LiveAnnouncementService(client)
    }
    export type { AnnouncementService } from "./types";
    export  { mockAnnouncementService } from "./mockAnnouncementService";
    export {LiveAnnouncementService } from "./announcementService";