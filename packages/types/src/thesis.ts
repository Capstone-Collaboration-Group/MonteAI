export interface SubmitThesisDto {
  title: string;
  abstract: string;
  filePath?: string;
  uploadedById: string;
  /** Admin archival uploads: author names, one array entry per author. */
  authors?: string[];
  /** Admin archival uploads: 4-digit publication year. */
  publicationYear?: string;
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
  filePath?: string;
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
  /** Firestore-resolved publication year (admin archival uploads). */
  publicationYear?: string;
  institute?: string;
}



export interface ThesisCatalogCounts { 
  active: number;
  archived: number;
}



export type ThesisStatus = "pending" | "approved" | "scheduled" | "rejected" | "revision" | "indexed";

/**
 * Catalog row actions. Moderation actions (approve/reject/revision/schedule)
 * are reviewer powers; "edit"/"delete" are full-CRUD management actions that
 * desktop only passes for Admin sessions (web/mobile stay read-only).
 */
export type ThesisActionType =
  | "approve"
  | "reject"
  | "revision"
  | "schedule"
  | "edit"
  | "delete";

// ── Academic programs ────────────────────────────────────────────────────────
// Codes sent to the API as ?program=; labels are the canonical display names
// (mirrors packages/ui INSTITUTES). Keyword matching mirrors the server's
// ThesisRepository so mock and live filtering behave identically — stored
// institute values are full names that vary slightly across sources, so both
// sides match on keywords rather than equality. Bare "education" is never an
// ITE keyword: it would collide with "Institute of Business Education".
export type ThesisProgram = "ICS" | "IBE" | "ITE";

export const THESIS_PROGRAMS: ReadonlyArray<{ code: ThesisProgram; label: string }> = [
  { code: "ICS", label: "Institute of Computing Studies" },
  { code: "IBE", label: "Institute of Business and Entrepreneurship" },
  { code: "ITE", label: "Institute of Teacher Education" },
];

const PROGRAM_KEYWORDS: Record<ThesisProgram, string[]> = {
  ICS: ["computing", "computer", "ics"],
  IBE: ["business", "entrepreneurship", "ibe"],
  ITE: ["teaching", "teacher", "technology", "ite"],
};

/** Case-insensitive keyword match of a stored institute against a program. */
export function instituteMatchesProgram(
  institute: string | null | undefined,
  program: ThesisProgram
): boolean {
  const value = (institute ?? "").toLowerCase();
  return PROGRAM_KEYWORDS[program].some((keyword) => value.includes(keyword));
}

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


export function toThesisSummary(dto: ThesisResponseDto): ThesisSummary { 
  return { 
    id: dto.id,
    groupId: dto.groupId,
    title: dto.title ?? "Untitled",
    authors: dto.authors ?? [],
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
  filePath?: string;
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

// Who is looking at the PDF viewer. Adviser/faculty/program-head/admin may
// create annotations; students only view them.
export type ViewerRole = "adviser" | "faculty" | "program_head" | "admin" | "student";

/**
 * Maps the API profile role (UserProfileDto.role: "Student" | "Faculty" |
 * "Admin" | "ProgramHead") onto the viewer vocabulary. Anything unrecognized
 * falls back to "student" — the least-privileged role (view-only, no
 * moderation actions).
 */
export function toViewerRole(role: string | null | undefined): ViewerRole {
  switch (role) {
    case "Admin":
      return "admin";
    case "ProgramHead":
      return "program_head";
    case "Faculty":
      return "faculty";
    case "Student":
    default:
      return "student";
  }
}

