import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ScheduleService } from "@monteai/api";
import type {
  CreateScheduleDto,
  UpdateScheduleDto,
  UpdateScheduleTimesDto,
  ScheduleResponseDto,
} from "@monteai/types";

export const scheduleKeys = { 
    all: ["schedules"] as const,
    detail: (id: string) => ["schedules", id] as const,
}

export function useSchedules(scheduleService: ScheduleService) { 
    return useQuery({
        queryKey: scheduleKeys.all,
        queryFn: () => scheduleService.getSchedules(),
        //recent fix. still need to test
        select: (data) => (Array.isArray(data) ? data : []),
    });
}


export function useCreateSchedule(scheduleService: ScheduleService) { 
    const queryClient = useQueryClient();
    return useMutation( { 
       mutationFn: (dto: CreateScheduleDto) => scheduleService.createSchedule(dto),
       onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    });
}

export function useUpdateSchedule(scheduleService: ScheduleService) { 
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateScheduleDto }) => 
            scheduleService.updateSchedule(id, dto),
        // Optimistically apply drag/resize/edit results so the calendar reacts
        // instantly instead of waiting for the refetch round-trip.
        onMutate: async ({ id, dto }: { id: string; dto: UpdateScheduleDto }) => {
            await queryClient.cancelQueries({ queryKey: scheduleKeys.all });
            const previous =
                queryClient.getQueryData<ScheduleResponseDto[]>(scheduleKeys.all);
            queryClient.setQueryData<ScheduleResponseDto[]>(
                scheduleKeys.all,
                (old = []) =>
                    old.map((s) =>
                        s.scheduleId === id
                            ? {
                                  ...s,
                                  ...dto,
                                  panelists: dto.panelists ?? s.panelists,
                              }
                            : s,
                    ),
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(scheduleKeys.all, context.previous);
            }
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    });
}

export function useDeleteSchedule(scheduleService: ScheduleService) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (scheduleId: string) => scheduleService.deleteSchedule(scheduleId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    });
}

export function useUpdateScheduleTimes(scheduleService: ScheduleService) { 
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateScheduleTimesDto }) => 
            scheduleService.updateScheduleTimes(id, dto),
        // Optimistically apply drag/resize results so the calendar reacts
        // instantly instead of waiting for the refetch round-trip.
        onMutate: async ({ id, dto }: { id: string; dto: UpdateScheduleTimesDto }) => {
            await queryClient.cancelQueries({ queryKey: scheduleKeys.all });
            const previous =
                queryClient.getQueryData<ScheduleResponseDto[]>(scheduleKeys.all);
            queryClient.setQueryData<ScheduleResponseDto[]>(
                scheduleKeys.all,
                (old = []) =>
                    old.map((s) =>
                        s.scheduleId === id
                            ? {
                                  ...s,
                                  date: dto.date,
                                  startTime: dto.startTime,
                                  endingTime: dto.endingTime,
                              }
                            : s,
                    ),
            );
            return { previous };
        },
        onError: (_error, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(scheduleKeys.all, context.previous);
            }
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    });
}