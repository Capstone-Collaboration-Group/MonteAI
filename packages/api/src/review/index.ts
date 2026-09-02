import type { AxiosInstance } from "axios";
import { mockReviewService } from "./mockReviewService";
import { LiveReviewService } from "./reviewService";
import type { ReviewService } from "./types";

export function createReviewService(
    client: AxiosInstance,
    useMock: boolean
): ReviewService  {
    return useMock ? mockReviewService : new LiveReviewService(client)
}
export type { ReviewService } from "./types";
export { mockReviewService } from "./mockReviewService";
export { LiveReviewService } from "./reviewService";