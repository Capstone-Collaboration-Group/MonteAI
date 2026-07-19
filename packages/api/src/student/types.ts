import type { 
    CreateStudentDto,
    UpdateStudentDto,
    StudentResponseDto
} from "@monteai/types";
export interface StudentService { 
    getStudents(): Promise<StudentResponseDto[] | []>;
    getStudent(studentId: string): Promise<StudentResponseDto | null>;
    createStudent(dto: CreateStudentDto): Promise<boolean>;
    updateStudent(studentId: string, dto: UpdateStudentDto): Promise<boolean>;
    deleteStudent(studentId: string): Promise<boolean>;
}
