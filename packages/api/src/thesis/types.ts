import type { 
    SubmitThesisDto,
    UpdateThesisDto,
    ThesisResponseDto,
    IngestThesisDto,
    IngestThesisResponseDto,
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
    ThesisVersion,
    ThesisProgram
} from "@monteai/types";
export interface ThesisService { 
    submitThesis(dto: SubmitThesisDto, file: File): Promise<ThesisResponseDto>;
    ingestThesis(dto: IngestThesisDto): Promise<IngestThesisResponseDto>;
    getDownloadUrl(thesisId: string): Promise<{url: string} | null>
    getThesis(thesisId: string): Promise<ThesisResponseDto | null>;
    /** The caller's own group thesis (GET /thesis/my); null/404 = not submitted yet. */
    getMyThesis(): Promise<ThesisResponseDto | null>;
    /** @param program Optional academic-program filter (ICS / IBE / ITE); omitted/unknown returns unfiltered. */
    getTheses(program?: ThesisProgram): Promise<ThesisResponseDto[]>;
    /** Searches the catalog with a fast SQL title/author match or Pinecone similarity. */
    searchTheses(query: string, mode: "exact" | "semantic"): Promise<ThesisResponseDto[]>;
    updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean>;
    updateThesisStatus(thesisId: string, status: string): Promise<boolean>;
    deleteThesis(thesisId: string): Promise<boolean>;

    // Annotations 
    getAnnotations(thesisId: string, versionId: string): Promise<AnnotationResponseDto[]>;
    createAnnotation(thesisId: string, dto: CreateAnnotationDto): Promise<boolean>;
    resolveAnnotation(thesisId: string, annotationId: string, dto: ResolveAnnotationDto): Promise<boolean>;
    deleteAnnotation(thesisId: string, annotationId: string): Promise<boolean>;

    // versions
    getVersions(thesisId: string): Promise<ThesisVersion[]>;
    getVersionFile(versionId: string): Promise<{ url: string } | null>;
    /** @param abstractText Optional revised abstract stored with this version. */
    createThesisVersion(thesisId: string, file: File, changeNote?: string, abstractText?: string): Promise<boolean>;
    /**
     * Deletes ONE version — latest-only (server rejects non-latest with 400).
     * Deleting the final version cascades into deleting the whole thesis.
     */
    deleteThesisVersion(thesisId: string, versionId: string): Promise<boolean>;
    
    // Proceedings
    generateProceedings(thesisId: string): Promise<Blob>;
}
