import {
    type FacultyResponseDto,
    type CreateFacultyDto,
    type UpdateFacultyDto
} from "@monteai/types";

export interface FacultyService {
    getFaculties(): Promise<FacultyResponseDto[] | []>;
    getFaculty(facultyId: string): Promise<FacultyResponseDto | null>;
    createFaculty(dto: CreateFacultyDto): Promise<FacultyResponseDto>;
    updateFaculty(facultyId: string, dto: UpdateFacultyDto): Promise<boolean>;
    deleteFaculty(facultyId: string): Promise<boolean>;
}