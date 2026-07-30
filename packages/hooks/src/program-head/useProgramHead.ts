import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProgramHeadDto,
  UpdateProgramHeadDto,
} from "@monteai/types";
import type { ProgramHeadService } from "@monteai/api";

export const programHeadKeys = {
  all: ["program-heads"] as const,
  detail: (programHeadId: string) =>
    ["program-heads", programHeadId] as const,
};

// Get all program heads
export function useProgramHeads(programHeadService: ProgramHeadService) {
  return useQuery({
    queryKey: programHeadKeys.all,
    queryFn: () => programHeadService.getProgramHeads(),
  });
}

// Get program head by id
export function useProgramHead(programHeadService: ProgramHeadService, programHeadId: string) {
  return useQuery({
    queryKey: programHeadKeys.detail(programHeadId),
    queryFn: () => programHeadService.getProgramHead(programHeadId),
    enabled: !!programHeadId,
  });
}

// Create program head
export function useCreateProgramHead(programHeadService: ProgramHeadService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProgramHeadDto) =>
      programHeadService.createProgramHead(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: programHeadKeys.all,});
    },
  });
}

// Update program head
export function useUpdateProgramHead(programHeadService: ProgramHeadService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({programHeadId, dto,}: {programHeadId: string; dto: UpdateProgramHeadDto;}) =>
      programHeadService.updateProgramHead(programHeadId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: programHeadKeys.all,});
    },
  });
}

// Delete program head
export function useDeleteProgramHead(programHeadService: ProgramHeadService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (programHeadId: string) =>
      programHeadService.deleteProgramHead(programHeadId),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: programHeadKeys.all,});
    },
  });
}