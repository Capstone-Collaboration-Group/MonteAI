import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSubmissionDto,
  UpdateSubmissionDto,
} from "@monteai/types";
import type { SubmissionService } from "@monteai/api";

export const submissionKeys = {
  all: ["submissions"] as const,
  detail: (submissionId: string) =>
    ["submissions", submissionId] as const,
};

// Get all submissions
export function useSubmissions(submissionService: SubmissionService) {
  return useQuery({
    queryKey: submissionKeys.all,
    queryFn: () => submissionService.getSubmissions(),
  });
}

// Get submission by id
export function useSubmission(submissionService: SubmissionService, submissionId: string) {
  return useQuery({
    queryKey: submissionKeys.detail(submissionId),
    queryFn: () => submissionService.getSubmission(submissionId),
    enabled: !!submissionId,
  });
}

// Create submission
export function useCreateSubmission(submissionService: SubmissionService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateSubmissionDto) =>
      submissionService.createSubmission(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: submissionKeys.all,});
    },
  });
}

// Update submission
export function useUpdateSubmission(submissionService: SubmissionService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({submissionId, dto,}: {submissionId: string; dto: UpdateSubmissionDto;}) =>
      submissionService.updateSubmission(submissionId, dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: submissionKeys.all,});
    },
  });
}

// Delete submission
export function useDeleteSubmission(submissionService: SubmissionService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId: string) =>
      submissionService.deleteSubmission(submissionId),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: submissionKeys.all,});
    },
  });
}