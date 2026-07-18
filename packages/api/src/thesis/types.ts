import type { 
    SubmitThesisDto,
    UpdateThesisDto,
    ThesisResponseDto
} from "@monteai/types";
export interface ThesisService { 
    submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto>;
    updateThesis(thesisID: string, dto: UpdateThesisDto): Promise<boolean>;
    getThesis(thesisId: string): Promise<ThesisResponseDto | null>;
    deleteThesis(thesisId: string): Promise<boolean>;
}