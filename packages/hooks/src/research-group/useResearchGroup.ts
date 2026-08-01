import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateResearchGroupDto,
  UpdateResearchGroupDto,
} from "@monteai/types";
import type { ResearchGroupService } from "@monteai/api";

export const researchGroupKeys = {
  all: ["research-groups"] as const,
  detail: (researchGroupId: string) =>
    ["research-groups", researchGroupId] as const,
};

// Get all research groups
export function useResearchGroups(researchGroupService: ResearchGroupService) {
  return useQuery({
    queryKey: researchGroupKeys.all,
    queryFn: () => researchGroupService.getResearchGroups(),
  });
}

// Get research group by id
export function useResearchGroup(researchGroupService: ResearchGroupService, researchGroupId: string) {
  return useQuery({
    queryKey: researchGroupKeys.detail(researchGroupId),
    queryFn: () => researchGroupService.getResearchGroup(researchGroupId),
    enabled: !!researchGroupId,
  });
}

// Create research group
export function useCreateResearchGroup(researchGroupService: ResearchGroupService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateResearchGroupDto) =>
      researchGroupService.createResearchGroup(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: researchGroupKeys.all,});
    },
  });
}

// Update research group
export function useUpdateResearchGroup(researchGroupService: ResearchGroupService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({researchGroupId, dto,}: {researchGroupId: string; dto: UpdateResearchGroupDto;}) =>
      researchGroupService.updateResearchGroup(researchGroupId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: researchGroupKeys.all,});
    },
  });
}

// Delete research group
export function useDeleteResearchGroup(researchGroupService: ResearchGroupService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (researchGroupId: string) =>
      researchGroupService.deleteResearchGroup(researchGroupId),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: researchGroupKeys.all,});
    },
  });
}