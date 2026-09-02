import type { 
    SubmitThesisDto,
    UpdateThesisDto,
    ThesisResponseDto,
    IngestThesisDto,
    IngestThesisResponseDto,
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
    ThesisVersion
} from "@monteai/types";
export interface ThesisService { 
    submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto>;
    ingestThesis(dto: IngestThesisDto): Promise<IngestThesisResponseDto>;
    getDownloadUrl(thesisId: string): Promise<{url: string} | null>
    getThesis(thesisId: string): Promise<ThesisResponseDto | null>;
    getTheses(): Promise<ThesisResponseDto[]>;
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
    
    // Proceedings
    generateProceedings(thesisId: string): Promise<Blob>;
}

