import type { 
    CreateStudentDto,
    UpdateStudentDto,
    StudentResponseDto
} from "@monteai/types";

export interface StudentDirectoryParams {
    /** Free-text match against full name or student number. */
    search?: string;
    /** Restrict results to a single program. */
    program?: string;
}

export interface StudentService { 
    getStudents(params?: StudentDirectoryParams): Promise<StudentResponseDto[] | []>;
    getStudent(studentId: string): Promise<StudentResponseDto | null>;
    createStudent(dto: CreateStudentDto): Promise<boolean>;
    updateStudent(studentId: string, dto: UpdateStudentDto): Promise<boolean>;
    deleteStudent(studentId: string): Promise<boolean>;
}
