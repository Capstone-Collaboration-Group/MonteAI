import { useFaculties } from "@monteai/hooks";
import { useProgramHeads } from "@monteai/hooks";
import type { FacultyService } from "@monteai/api";
import type { ProgramHeadService } from "@monteai/api";
import { FacultyView, FacultyViewSkeleton } from "../components/Faculty";

interface FacultyPageProps {
  facultyService: FacultyService;
  programHeadService: ProgramHeadService;
  onCreateNew?: () => void;
}

export function FacultyPage({
  facultyService,
  programHeadService,
  onCreateNew,
}: FacultyPageProps) {
  const {
    data: faculties = [],
    isLoading: loadingFaculty,
    error: facultyError,
  } = useFaculties(facultyService);

  const {
    data: programHeads = [],
    isLoading: loadingPH,
    error: phError,
  } = useProgramHeads(programHeadService);

  if (loadingFaculty || loadingPH) {
    return <FacultyViewSkeleton />;
  }

  return (
    <FacultyView
      faculties={faculties}
      programHeads={programHeads}
      isLoading={loadingFaculty || loadingPH}
      hasError={!!facultyError || !!phError}
      onCreateNew={onCreateNew}
    />
  );
}
