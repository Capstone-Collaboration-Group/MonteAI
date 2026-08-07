import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFacultyDto,
  UpdateFacultyDto,
} from "@monteai/types";
import type { FacultyService } from "@monteai/api";

export const facultyKeys = {
  all: ["faculties"] as const,
  detail: (facultyId: string) =>
    ["faculties", facultyId] as const,
};

// Get all faculties
export function useFaculties(facultyService: FacultyService) {
  return useQuery({
    queryKey: facultyKeys.all,
    queryFn: () => facultyService.getFaculties(),
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

// Get faculty by id
export function useFaculty(facultyService: FacultyService, facultyId: string) {
  return useQuery({
    queryKey: facultyKeys.detail(facultyId),
    queryFn: () => facultyService.getFaculty(facultyId),
    enabled: !!facultyId,
  });
}

// Create faculty
export function useCreateFaculty(facultyService: FacultyService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateFacultyDto) =>
      facultyService.createFaculty(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: facultyKeys.all,});
    },
  });
}

// Update faculty
export function useUpdateFaculty(facultyService: FacultyService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({facultyId, dto,}: {facultyId: string; dto: UpdateFacultyDto;}) =>
      facultyService.updateFaculty(facultyId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: facultyKeys.all,});
    },
  });
}

// Delete faculty
export function useDeleteFaculty(facultyService: FacultyService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (facultyId: string) =>
      facultyService.deleteFaculty(facultyId),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: facultyKeys.all,});
    },
  });
}