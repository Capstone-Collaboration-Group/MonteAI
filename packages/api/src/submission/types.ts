import type  {
    CreateSubmissionDto,
    UpdateSubmissionDto,
    SubmissionResponseDto
} from "@monteai/types";

export interface SubmissionService { 
    getSubmissions(): Promise<SubmissionResponseDto[] | []>;
    getSubmission(submissionId: string): Promise<SubmissionResponseDto | null>;
    createSubmission(dto: CreateSubmissionDto): Promise<boolean>;
    updateSubmission(submissionId: string, dto: UpdateSubmissionDto): Promise<boolean>;
    deleteSubmission(submissionId: string): Promise<boolean>;
}
