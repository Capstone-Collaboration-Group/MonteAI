import type { AxiosInstance } from "axios";
import { mockPanelistScheduleService } from "./mockPanelistScheduleService";
import { LivePanelistScheduleService } from "./panelistScheduleService";
import type { PanelistScheduleService } from "./types";

export function createPanelistScheduleService(
    client: AxiosInstance,
    useMock: boolean
): PanelistScheduleService  {
    return useMock ? mockPanelistScheduleService : new LivePanelistScheduleService(client)
}
export type { PanelistScheduleService } from "./types";
export  { mockPanelistScheduleService } from "./mockPanelistScheduleService";
export {LivePanelistScheduleService } from "./panelistScheduleService";