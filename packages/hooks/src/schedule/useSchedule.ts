import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ScheduleService } from "@monteai/api";
import type { CreateScheduleDto, UpdateScheduleDto  } from "@monteai/types";

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
        onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
    });
}