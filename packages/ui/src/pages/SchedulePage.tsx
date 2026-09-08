import {
  useSchedules,
  useUpdateSchedule,
  useUpdateScheduleTimes,
  useDeleteSchedule,
  usePanelistPool,
} from "@monteai/hooks";
import type {
  ScheduleService,
  FacultyService,
  ProgramHeadService,
  AdminService,
} from "@monteai/api";
import type { UpdateScheduleDto, UpdateScheduleTimesDto } from "@monteai/types";
import {
  ScheduleCalendar,
  ScheduleCalendarSkeleton,
} from "../components/Schedule";
import { showToast } from "../components/common";

interface SchedulePageProps {
  scheduleService: ScheduleService;
  onCreateNew?: () => void;
  /** Admin-only: enables drag/move, resize, and the Edit action. */
  canEdit?: boolean;
  /** Member services (faculty/program-head/admin) used to load the panelist
   *  pool when the admin opens the edit form. */
  facultyService?: FacultyService;
  programHeadService?: ProgramHeadService;
  adminService?: AdminService;
}

export function SchedulePage({
  scheduleService,
  onCreateNew,
  canEdit = false,
  facultyService,
  programHeadService,
  adminService,
}: SchedulePageProps) {
  const { data: schedules = [], isLoading } = useSchedules(scheduleService);
  const { mutateAsync: updateSchedule } = useUpdateSchedule(scheduleService);
  const { mutateAsync: updateScheduleTimes } =
    useUpdateScheduleTimes(scheduleService);
  const { mutateAsync: deleteSchedule } = useDeleteSchedule(scheduleService);
  const { data: panelistPool = [] } = usePanelistPool(
    facultyService,
    programHeadService,
    adminService,
    canEdit,
  );

  const handleUpdateSchedule = async (
    scheduleId: string,
    dto: UpdateScheduleDto,
  ) => {
    try {
      await updateSchedule({ id: scheduleId, dto });
      showToast({ title: "Schedule updated", type: "success" });
    } catch {
      showToast({
        title: "Could not update the schedule",
        type: "error",
      });
    }
  };

  const handleUpdateScheduleTimes = async (
    scheduleId: string,
    times: UpdateScheduleTimesDto,
  ) => {
    try {
      await updateScheduleTimes({ id: scheduleId, dto: times });
      showToast({ title: "Schedule updated", type: "success" });
    } catch {
      showToast({
        title: "Could not update the schedule",
        type: "error",
      });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      showToast({ title: "Schedule deleted", type: "error" });
    } catch {
      showToast({
        title: "Could not delete the schedule",
        type: "error",
      });
    }
  };

  if (isLoading) {
    return <ScheduleCalendarSkeleton />;
  }

  return (
    <ScheduleCalendar
      schedules={schedules}
      isLoading={isLoading}
      canEdit={canEdit}
      panelistPool={panelistPool}
      onUpdateSchedule={handleUpdateSchedule}
      onUpdateScheduleTimes={handleUpdateScheduleTimes}
      onDeleteSchedule={handleDeleteSchedule}
      onCreateNew={onCreateNew}
    />
  );
}
