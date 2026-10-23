// packages/types/src/citation.ts
//
// APA 7th-edition citation contracts (POST /api/v1/chat/citations/apa) —
// powers the "Cite" button on assistant chat messages.

/** One formatted APA 7 reference paired back to its source. */
export interface ApaCitationDto {
  /** Cited thesis id (null for partial matches) — pairs the row with its source. */
  thesisId?: string | null;
  citation: string;
}

export interface ApaCitationResponseDto {
  citations: ApaCitationDto[];
}
