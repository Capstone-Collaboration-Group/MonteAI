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

// Get all panelist schedules
export function usePanelistSchedules(panelistScheduleService: PanelistScheduleService) {
  return useQuery({
    queryKey: panelistScheduleKeys.all,
    queryFn: () => panelistScheduleService.getPanelistSchedules(),
  });
}

// Get all schedules for a specific panelist
export function usePanelistSchedulesById(panelistScheduleService: PanelistScheduleService, panelistId: string) {
  return useQuery({
    queryKey: panelistScheduleKeys.byPanelist(panelistId),
    queryFn: () => panelistScheduleService.getPanelistSchedulesById(panelistId),
    enabled: !!panelistId,
  });
}

// Get a specific panelist schedule
export function usePanelistScheduleById(panelistScheduleService: PanelistScheduleService, scheduleId: string, panelistId: string) {
  return useQuery({
    queryKey: panelistScheduleKeys.detail(scheduleId, panelistId),
    queryFn: () => panelistScheduleService.getPanelistScheduleById(scheduleId, panelistId),
    enabled: !!scheduleId && !!panelistId,
  });
}

// Create panelist schedule
export function useCreatePanelistSchedule(panelistScheduleService: PanelistScheduleService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreatePanelistScheduleDto) =>
      panelistScheduleService.createPanelistSchedule(dto),

    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: panelistScheduleKeys.all,});
    },
  });
}

// Update panelist schedule
export function useUpdatePanelistSchedule(panelistScheduleService: PanelistScheduleService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({scheduleId, panelistId, dto,}: {scheduleId: string; panelistId: string; dto: UpdatePanelistScheduleDto;}) =>
      panelistScheduleService.updatePanelistSchedule(scheduleId, panelistId, dto),
    onSuccess: () => {queryClient.invalidateQueries({ queryKey: panelistScheduleKeys.all,});},
  });
}

// Delete panelist schedule
export function useDeletePanelistSchedule(panelistScheduleService: PanelistScheduleService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => 
      panelistScheduleService.deletePanelistSchedule(scheduleId),
    onSuccess: () => {queryClient.invalidateQueries({queryKey: panelistScheduleKeys.all,});},
  });
}