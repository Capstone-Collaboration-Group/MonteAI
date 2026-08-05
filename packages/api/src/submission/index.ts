import type { AxiosInstance } from "axios";
import { mockSubmissionService } from "./mockSubmissionService";
import { LiveSubmissionService } from "./submissionService";
import type { SubmissionService } from "./types";

export function createSubmissionService(
    client: AxiosInstance,
    useMock: boolean
): SubmissionService  {
    return useMock ? mockSubmissionService : new LiveSubmissionService(client)
}

export type { SubmissionService } from "./types";
export { mockSubmissionService } from "./mockSubmissionService";
export { LiveSubmissionService } from "./submissionService";