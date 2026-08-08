import { usePanelistSchedules } from "@monteai/hooks";
import { useSchedules } from "@monteai/hooks";
import type { PanelistScheduleService, ScheduleService } from "@monteai/api";
import { PanelistView } from "../components/Panelist/PanelistView";

interface PanelistPageProps {
  panelistScheduleService: PanelistScheduleService;
  /** Used to resolve each assignment's scheduleId -> full schedule (room, group, etc.) in the detail panel */
  scheduleService: ScheduleService;
  onCreateNew?: () => void;
}

export function PanelistPage({ panelistScheduleService, scheduleService, onCreateNew }: PanelistPageProps) {
  const {
    data: panelists = [],
    isLoading: loadingPanelists,
    error: panelistError,
  } = usePanelistSchedules(panelistScheduleService);

  // Schedule pool — used to enrich each assignment with room venue / full schedule info
  const {
    data: schedules = [],
    isLoading: loadingSchedules,
  } = useSchedules(scheduleService);

  return (
    <PanelistView
      panelists={panelists}
      schedules={schedules}
      isLoading={loadingPanelists || loadingSchedules}
      hasError={!!panelistError}
      onCreateNew={onCreateNew}
    />
  );
}