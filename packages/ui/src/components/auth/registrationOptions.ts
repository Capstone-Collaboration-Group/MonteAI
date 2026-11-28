import type { SelectOption } from "../common/Select";

export const INSTITUTE_OPTIONS: SelectOption[] = [
  { value: "ICS", label: "Institute of Computing Studies" },
  { value: "IBE", label: "Institute of Business and Entrepreneurship" },
  { value: "ITE", label: "Institute of Teacher Education" },
];

export const PROGRAM_OPTIONS: SelectOption[] = [
  { value: "BSIT", label: "Bachelor of Science in Information Technology" },
  { value: "BSCPE", label: "Bachelor of Science in Computer Engineering" },
  { value: "BSBA-HRM", label: "Bachelor of Science in Business Administration Major in Human Resource Management" },
  { value: "BSE", label: "Bachelor of Science in Entrepreneurship" },
  { value: "BSEd-Sci", label: "Bachelor of Secondary Education Major in Science" },
  { value: "BEEd-Gen", label: "Bachelor of Elementary Education - Generalist / General Education" },
  { value: "BECEd", label: "Bachelor of Early Childhood Education" },
  { value: "BTLEd-ICT", label: "Bachelor of Technology and Livelihood Education Major in Information and Communications Technology" },
];

export const YEAR_OPTIONS: SelectOption[] = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
];

export const SECTION_OPTIONS: SelectOption[] = [
  ...Array.from("ABCDEFGHIJ", (section) => ({ value: section, label: section })),
];

export const PROGRAM_INSTITUTE: Record<string, string> = {
  BSIT: "ICS",
  BSCPE: "ICS",
  "BSBA-HRM": "IBE",
  BSE: "IBE",
  "BSEd-Sci": "ITE",
  "BEEd-Gen": "ITE",
  BECEd: "ITE",
  "BTLEd-ICT": "ITE",
};

export function programsForInstitute(institute: string): SelectOption[] {
  return institute
    ? PROGRAM_OPTIONS.filter((program) => PROGRAM_INSTITUTE[program.value] === institute)
    : PROGRAM_OPTIONS;
}

export function instituteLabel(code: string): string {
  return INSTITUTE_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

export function programLabel(code: string): string {
  return PROGRAM_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

export function normalizeInstitute(value: string): string {
  const aliases: Record<string, string> = {
    "Institute of Computing Studies": "ICS",
    "Institute of Computer Studies": "ICS",
    "Institute of Teaching Education": "ITE",
    "Institute of Teacher Education": "ITE",
  };
  return INSTITUTE_OPTIONS.find((option) => option.label === value)?.value ?? aliases[value] ?? value;
}

export function normalizeProgram(value: string): string {
  const aliases: Record<string, string> = {
    "BS Information Technology": "BSIT",
    "BS Computer Science": "BSCPE",
    "BS Data Science": "BSCPE",
  };
  return PROGRAM_OPTIONS.find((option) => option.label === value)?.value ?? aliases[value] ?? value;
}
