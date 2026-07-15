export interface SubmitThesisDto {
  title: string;
  abstract: string;
  filePath: string;
  uploadedById: string;
}

export interface UpdateThesisDto {
  title?: string;
  abstract?: string;
  filePath?: string;
}

export interface UpdateThesisStatusDto {
  status: string;
}

export interface ThesisResponseDto {
  id: string;
  title?: string;
  abstract?: string;
  filePath: string;
  uploadedById: string;
  status?: string;
  pineconeStatus?: string;
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  indexedAt?: string;
  updatedAt: string;
}