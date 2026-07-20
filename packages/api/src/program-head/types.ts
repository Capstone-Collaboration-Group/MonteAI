import type{
    CreateProgramHeadDto,
    UpdateProgramHeadDto,
    ProgramHeadResponseDto
} from "@monteai/types";

export interface ProgramHeadService {
    getProgramHeads(): Promise<ProgramHeadResponseDto[] | []>;
    getProgramHead(programHeadId: string): Promise<ProgramHeadResponseDto | null>;
    createProgramHead(dto: CreateProgramHeadDto): Promise<ProgramHeadResponseDto>;
    updateProgramHead(programHeadId: string, dto: UpdateProgramHeadDto): Promise<boolean>;
    deleteProgramHead(programHeadId: string): Promise<boolean>;
}