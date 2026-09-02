import type { AxiosInstance } from "axios";
import { mockStudentService } from "./mockStudentService";
import { LiveStudentService } from "./studentService";
import type { StudentService } from "./types";

export function createStudentService(
    client: AxiosInstance,
    useMock: boolean
): StudentService  {
    return useMock ? mockStudentService : new LiveStudentService(client)
}
export type { StudentService } from "./types";
export { mockStudentService } from "./mockStudentService";
export { LiveStudentService } from "./studentService";