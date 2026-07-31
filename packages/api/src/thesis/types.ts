import type { 
    SubmitThesisDto,
    UpdateThesisDto,
    ThesisResponseDto,
    IngestThesisDto,
    IngestThesisResponseDto
} from "@monteai/types";
export interface ThesisService { 
    submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto>;
    ingestThesis(dto: IngestThesisDto): Promise<IngestThesisResponseDto>;
    getThesis(thesisId: string): Promise<ThesisResponseDto | null>;
    getTheses(): Promise<ThesisResponseDto[]>;
    updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean>;
    updateThesisStatus(thesisId: string, status: string): Promise<boolean>;
    deleteThesis(thesisId: string): Promise<boolean>;
}

