import { type AxiosInstance } from "axios";
import {
    type ReviewResponseDto,
    type CreateReviewDto,
    type UpdateReviewDto,
} from "@monteai/types";
import { handle404 } from "@monteai/utils";

import type { ReviewService } from "./types";

export class LiveReviewService implements ReviewService {
    private readonly client: AxiosInstance
    constructor(client: AxiosInstance) {
        this.client = client;
    }

    async getReviews(): Promise<ReviewResponseDto[] | []> {
        try {
            const { data } = await this.client.get<ReviewResponseDto[]>(`review`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }

    async getReview(reviewId: string): Promise<ReviewResponseDto | null> {
        try {
            const { data } = await this.client.get<ReviewResponseDto>(`review/${reviewId}`);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    async createReview(dto: CreateReviewDto): Promise<ReviewResponseDto> {
        const { data } = await this.client.post<ReviewResponseDto>(`review/create`, dto);
        return data;
    }

    async updateReview(reviewId: string, dto: UpdateReviewDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`review/update/${reviewId}`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteReview(reviewId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(`review/delete/${reviewId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
}