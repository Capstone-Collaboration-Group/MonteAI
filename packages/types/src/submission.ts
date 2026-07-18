export interface CreateSubmissionDto {
  thesisId: string;
  studentNumber: string;
  notes?: string;
}

export interface UpdateSubmissionDto {
  notes?: string;
}

export interface SubmissionResponseDto {
  id: string;
  thesisId: string;
  studentNumber: string;
  submittedAt: string;
  notes?: string;
  thesisTitle?: string;
  studentName?: string;
}

export type SubmissionResponseListDto = SubmissionResponseDto[];