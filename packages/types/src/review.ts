export interface CreateReviewDto {
  thesisId: string;
  reviewerId: string;
  decision: string; // resolved | unresolved
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
  decision: string; // resolved |  unresolved
  comments?: string;
  reviewedAt?: string;
}

export type ReviewResponseListDto = ReviewResponseDto[];