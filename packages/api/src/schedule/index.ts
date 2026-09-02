import type { AxiosInstance } from "axios";
import { mockScheduleService } from "./mockScheduleService";
import { LiveScheduleService } from "./scheduleService";
import type { ScheduleService } from "./types";

export function createScheduleService(
  client: AxiosInstance,
  useMock: boolean
): ScheduleService {
  return useMock ? mockScheduleService : new LiveScheduleService(client);
}

export type { ScheduleService } from "./types";
export { mockScheduleService } from "./mockScheduleService";
export { LiveScheduleService } from "./scheduleService";    