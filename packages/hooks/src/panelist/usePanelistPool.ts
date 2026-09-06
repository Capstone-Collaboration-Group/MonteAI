// packages/hooks/src/usePanelistPool.ts
import { useQuery } from "@tanstack/react-query";
import type { FacultyService, ProgramHeadService,  AdminService} from "@monteai/api";
import type { PanelistCandidate } from "@monteai/types";

export function usePanelistPool(
  facultyService?: FacultyService,
  programHeadService?: ProgramHeadService,
  adminService?: AdminService,
  enabled = true,
) {
  const canFetch =
    enabled &&
    !!facultyService &&
    !!programHeadService &&
    !!adminService;

  return useQuery({
    queryKey: ["panelist-pool"],
    queryFn: async (): Promise<PanelistCandidate[]> => {
      const [faculty, programHeads, admins] = await Promise.all([
        facultyService!.getFaculties(),
        programHeadService!.getProgramHeads(),
        adminService!.getAdmins(),
      ]);

      return [
        ...faculty.map((f) => ({ ...f, panelistType: "faculty" as const })),
        ...programHeads.map((p) => ({ ...p, panelistType: "program-head" as const })),
        ...admins.map((a) => ({ ...a, panelistType: "admin" as const })),
      ];
    },
    enabled: canFetch,
    staleTime: 5 * 60 * 1000,
  });
}