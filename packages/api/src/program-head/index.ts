import type { AxiosInstance } from "axios";
import { mockProgramHeadService } from "./mockProgramHeadService";
import { LiveProgramHeadService } from "./programHeadService";
import type { ProgramHeadService } from "./types";

export function createProgramHeadService(
    client: AxiosInstance,
    useMock: boolean
): ProgramHeadService  {
    return useMock ? mockProgramHeadService : new LiveProgramHeadService(client)
}
export type { ProgramHeadService } from "./types";
export  { mockProgramHeadService } from "./mockProgramHeadService";
export {LiveProgramHeadService } from "./programHeadService";