import { type AxiosInstance } from "axios";
import  type { 
    CreateStudentDto,
    UpdateStudentDto,
    StudentResponseDto
} from "@monteai/types";
import { handle404 } from "@monteai/utils";
import { StudentService } from "./types";

export class LiveStudentService implements StudentService { 
    constructor (private readonly client: AxiosInstance) {}

    async getStudents(): Promise<StudentResponseDto[] | []> { 
        try { 
            const { data } = await this.client.get<StudentResponseDto[]>(`/student`)
            return data
        } catch (err) { 
            return handle404(err, []);
        }
    }
    async getStudent(studentId: string): Promise<StudentResponseDto | null> {
        try { 
            const { data } = await this.client.get<StudentResponseDto>(`/student/${studentId}`);
            return data;
        } catch (err) { 
            return handle404(err, null);
        }
    }
    async createStudent(dto: CreateStudentDto): Promise<boolean> {
        const { data } = await this.client.post<boolean>(`/student/create`, dto);
        return data;
    }
    async updateStudent(studentId: string, dto: UpdateStudentDto): Promise<boolean> {
        try { 
            const { data } = await this.client.patch<boolean>(`/student/update/${studentId}`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
    async deleteStudent(studentId: string): Promise<boolean> {
        try { 
            const { data } = await this.client.delete<boolean>(`/student/delete/${studentId}`);
            return data;
        } catch (err) { 
            return handle404(err, false);
        }
    }
}
