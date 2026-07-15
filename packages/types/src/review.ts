export interface CreateReviewDto {
  thesisId: string;
  reviewerId: string;
  decision: string;
  comments?: string;
}

export interface UpdateReviewDto {
  decision?: string;
  comments?: string;
}

export interface ReviewResponseDto {
  id: string;
  thesisId: string;
  reviewerId: string;
  decision: string;
  comments?: string;
  reviewedAt?: string;
}