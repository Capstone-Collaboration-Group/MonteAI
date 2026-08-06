import type { AxiosInstance } from "axios";
import { mockFacultyService } from "./mockFacultyService";
import { LiveFacultyService } from "./facultyService";
import type { FacultyService } from "./types";

export function createFacultyService(
    client: AxiosInstance,
    useMock: boolean
): FacultyService  {
    return useMock ? mockFacultyService : new LiveFacultyService(client)
}
export type { FacultyService } from "./types";
export  { mockFacultyService } from "./mockFacultyService";
export {LiveFacultyService } from "./facultyService";