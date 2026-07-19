import type { 
    SubmitThesisDto,
    UpdateThesisDto,
    ThesisResponseDto,
    ThesisResponseListDto
} from "@monteai/types";
export interface ThesisService { 
    submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto>;
    getThesis(thesisId: string): Promise<ThesisResponseDto | null>;
    getTheses(): Promise<ThesisResponseListDto>;
    updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean>;
    updateThesisStatus(thesisId: string, status: string): Promise<boolean>;
    deleteThesis(thesisId: string): Promise<boolean>;
}

