import type { AxiosInstance } from "axios";
import { mockResearchGroupService } from "./mockResearchGroupService";
import { LiveResearchGroupService } from "./researchGroupService";
import type { ResearchGroupService } from "./types";

export function createResearchGroupService(
    client: AxiosInstance,
    useMock: boolean
): ResearchGroupService  {
    return useMock ? mockResearchGroupService : new LiveResearchGroupService(client)
}
export type { ResearchGroupService } from "./types";
export { mockResearchGroupService } from "./mockResearchGroupService";
export { LiveResearchGroupService } from "./researchGroupService";