// packages/hooks/src/panelist-schedule/usePanelistSchedule.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePanelistScheduleDto,
  UpdatePanelistScheduleDto,
} from "@monteai/types";
import type { PanelistScheduleService } from "@monteai/api";

export const panelistScheduleKeys = {
  all: ["panelist-schedules"] as const,
  byPanelist: (panelistId: string) =>
    ["panelist-schedules", panelistId] as const,
  detail: (scheduleId: string, panelistId: string) =>
    ["panelist-schedules", scheduleId, panelistId] as const,
};

export function usePanelistSchedules(service: PanelistScheduleService) {
  return useQuery({
    queryKey: panelistScheduleKeys.all,
    queryFn: () => service.getPanelistSchedules(),
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

export function usePanelistSchedulesById(service: PanelistScheduleService, panelistId: string) {
  return useQuery({
    queryKey: panelistScheduleKeys.byPanelist(panelistId),
    queryFn: () => service.getPanelistSchedulesById(panelistId),
    enabled: !!panelistId,
  });
}

export function usePanelistScheduleById(service: PanelistScheduleService, scheduleId: string, panelistId: string) {
  return useQuery({
    queryKey: panelistScheduleKeys.detail(scheduleId, panelistId),
    queryFn: () => service.getPanelistScheduleById(scheduleId, panelistId),
    enabled: !!scheduleId && !!panelistId,
  });
}

export function useCreatePanelistSchedule(service: PanelistScheduleService) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePanelistScheduleDto) =>
      service.createPanelistSchedule(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelistScheduleKeys.all });
    },
  });
}

export function useUpdatePanelistSchedule(service: PanelistScheduleService) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, panelistId, dto }: {
      scheduleId: string;
      panelistId: string;
      dto: UpdatePanelistScheduleDto;
    }) => service.updatePanelistSchedule(scheduleId, panelistId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelistScheduleKeys.all });
    },
  });
}

export function useDeletePanelistSchedule(service: PanelistScheduleService) {
  const queryClient = useQueryClient();
  return useMutation({
    // Fixed: composite key needs both scheduleId and panelistId
    mutationFn: ({ scheduleId, panelistId }: { scheduleId: string; panelistId: string }) =>
      service.deletePanelistSchedule(scheduleId, panelistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelistScheduleKeys.all });
    },
  });
}