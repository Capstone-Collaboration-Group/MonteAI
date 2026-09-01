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
  groupId: string;
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
  scheduledAt: string;
  scheduledVenue: string;
  authors: string[];
  institute?: string;
}



export interface ThesisCatalogCounts { 
  active: number;
  archived: number;
}



export type ThesisStatus = "pending" | "approved" | "scheduled" | "rejected" | "revision" | "indexed";

export type ThesisActionType = "approve" | "reject" | "revision" | "schedule";

export interface ThesisSummary { 
  id: string;
  groupId: string;
  title: string;
  authors: string[];
  status: ThesisStatus
  submittedDate: string;
  excerpt?: string;
  institute: string;
}

export interface SubmissionHealthStatus { 
  approvalRate: number;
  yearLabel: string;
  note?: string;
}


export function toThesisSummary(dto: ThesisResponseDto): ThesisSummary { 
  return { 
    id: dto.id,
    groupId: dto.groupId,
    title: dto.title ?? "Untitled",
    authors: dto.authors,
    institute: dto.institute ?? "-",
    status: (dto.status?.toLowerCase() ?? "pending") as ThesisStatus,
    submittedDate: dto.submittedAt ?? dto.updatedAt,
    excerpt: dto.abstract,
  };
}

export interface ThesisChunk {
  chunkIndex:      number;
  text:            string;
  title?:          string;
  url?:            string;
  authors?:        string;   
  publicationYear?: string;
  journal?:        string;
}

export interface IngestThesisDto {
  thesisId: string;
  chunks:   ThesisChunk[];
}

export interface IngestThesisResponseDto  {
  thesisId: string;
  vectorCount: number;
  status: 'Indexed' | 'Failed';
}

export interface ThesisVersion { 
  id: string;
  thesisId: string;
  versionNumber: number;
  filePath: string;
  uploadedById: string;
  uploadedAt: string;
  changeNote?: string;
}

export interface AnnotationResponseDto { 
  id: string; 
  thesisId: string;
  thesisVersionId: string;
  reviewerId: string;
  comment: string;
  highlightedText?: string;
  positionJson: string;
  pageNumber: number;
  isResolved: boolean;
  resolvedAt: string;
  createdAt: string;
  resolverNote?: string;
}

export interface CreateAnnotationDto {
  thesisVersionId: string;
  comment: string;
  highlightedText?: string;
  positionJson: string;
  pageNumber: number;
}

export interface ResolveAnnotationDto { 
  isResolved: boolean;
  resolverNote?: string;
}

