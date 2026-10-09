import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateStudentDto,
  UpdateStudentDto,
} from "@monteai/types";
import type { StudentService, StudentDirectoryParams } from "@monteai/api";

export const studentKeys = {
  all: ["students"] as const,
  detail: (studentId: string) =>
    ["students", studentId] as const,
};

// Get all students (optionally filtered by search / program)
export function useStudents(
  studentService?: StudentService,
  params?: StudentDirectoryParams,
) {
  return useQuery({
    queryKey: [...studentKeys.all, "list", params?.search ?? "", params?.program ?? ""],
    queryFn: () => studentService!.getStudents(params),
    enabled: !!studentService,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

// Student directory search used by research-group invitations
export function useStudentDirectory(
  studentService?: StudentService,
  search?: string,
  program?: string,
) {
  return useQuery({
    queryKey: [...studentKeys.all, "directory", search ?? "", program ?? ""],
    queryFn: () => studentService!.getStudents({ search, program }),
    enabled: !!studentService,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

// Get student by id
export function useStudent(studentService: StudentService, studentId: string) {
  return useQuery({
    queryKey: studentKeys.detail(studentId),
    queryFn: () => studentService.getStudent(studentId),
    enabled: !!studentId,
  });
}

// Create student
export function useCreateStudent(studentService: StudentService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateStudentDto) =>
      studentService.createStudent(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

// Update student
export function useUpdateStudent(studentService: StudentService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, dto }: { studentId: string; dto: UpdateStudentDto }) =>
      studentService.updateStudent(studentId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}

// Delete student
export function useDeleteStudent(studentService: StudentService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) =>
      studentService.deleteStudent(studentId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.all });
    },
  });
}
