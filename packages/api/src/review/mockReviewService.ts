// packages/api/src/review/mockReviewService.ts

import type { ReviewService } from "./types";
import type {
  ReviewResponseDto,
  CreateReviewDto,
  UpdateReviewDto,
} from "@monteai/types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockReviewService loaded — Initialized with seed data");

function buildSeed(): ReviewResponseDto[] {
  return [
    {
      id: "review-1",
      thesisId: "thesis-1",
      reviewerId: "faculty-1",
      decision: "Approved",
      comments: "Excellent work. Minor formatting revisions only.",
      reviewedAt: "2025-02-10T09:00:00.000Z",
    },
    {
      id: "review-2",
      thesisId: "thesis-2",
      reviewerId: "faculty-2",
      decision: "Revision Required",
      comments: "Please improve the literature review and methodology.",
      reviewedAt: "2025-02-12T10:30:00.000Z",
    },
    {
      id: "review-3",
      thesisId: "thesis-3",
      reviewerId: "faculty-3",
      decision: "Rejected",
      comments: "The proposed methodology needs significant improvement.",
      reviewedAt: "2025-02-15T13:45:00.000Z",
    },
  ];
}

const reviewsMap = new Map<string, ReviewResponseDto>();

buildSeed().forEach((review) => reviewsMap.set(review.id, review));

export const mockReviewService: ReviewService = {
  async getReviews() {
    await delay(300);
    return Array.from(reviewsMap.values());
  },

  async getReview(reviewId: string) {
    await delay(150);
    return reviewsMap.get(reviewId) ?? null;
  },

  async createReview(dto: CreateReviewDto) {
    await delay(300);

    const id = crypto.randomUUID();

    const review: ReviewResponseDto = {
      id,
      thesisId: dto.thesisId,
      reviewerId: dto.reviewerId,
      decision: dto.decision,
      comments: dto.comments,
      reviewedAt: new Date().toISOString(),
    };

    reviewsMap.set(id, review);

    return review;
  },

  async updateReview(
    reviewId: string,
    dto: UpdateReviewDto
  ) {
    await delay(300);

    const existing = reviewsMap.get(reviewId);

    if (!existing) {
      return false;
    }

    reviewsMap.set(reviewId, {
      ...existing,
      ...dto,
      reviewedAt: new Date().toISOString(),
    });

    return true;
  },

  async deleteReview(reviewId: string) {
    await delay(200);
    return reviewsMap.delete(reviewId);
  },
};