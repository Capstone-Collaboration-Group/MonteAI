import { usePanelistSchedules } from "@monteai/hooks";
import type { PanelistScheduleService, ScheduleService } from "@monteai/api";
import { PanelistView, PanelistViewSkeleton } from "../components/Panelist";

interface PanelistPageProps {
  panelistScheduleService: PanelistScheduleService;
  /** Used to resolve each assignment's scheduleId -> full schedule (room, group, etc.) in the detail panel */
  onCreateNew?: () => void;
}

export function PanelistPage({
  panelistScheduleService,
  onCreateNew,
}: PanelistPageProps) {
  const {
    data: panelists = [],
    isLoading: loadingPanelists,
    error: panelistError,
  } = usePanelistSchedules(panelistScheduleService);

  // Schedule pool — used to enrich each assignment with room venue / full schedule info

  if (loadingPanelists) {
    return <PanelistViewSkeleton />;
  }

  return (
    <PanelistView
      panelists={panelists}
      isLoading={loadingPanelists}
      hasError={!!panelistError}
      onCreateNew={onCreateNew}
    />
  );
}
