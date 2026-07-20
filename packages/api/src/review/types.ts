import type{
    CreateReviewDto,
    UpdateReviewDto,
    ReviewResponseDto
} from "@monteai/types";

export interface ReviewService{
    getReviews(): Promise<ReviewResponseDto[] | []>;

    getReview(reviewId: string): Promise<ReviewResponseDto | null>;

    createReview(dto: CreateReviewDto): Promise<ReviewResponseDto>;

    updateReview(reviewId: string, dto: UpdateReviewDto): Promise<boolean>;

    deleteReview(reviewId: string): Promise<boolean>;
}