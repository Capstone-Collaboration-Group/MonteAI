// apps/desktop/src/renderer/pages/Faculty.tsx
import { FacultyPage } from "@monteai/ui";
import { facultyService } from "../lib/facultyService";
import { programHeadService } from "../lib/programHeadService";

export default function Faculty() {
  return (
    <FacultyPage
      facultyService={facultyService}
      programHeadService={programHeadService}
    />
  );
}