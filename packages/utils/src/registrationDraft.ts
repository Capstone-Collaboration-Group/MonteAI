import type {
  RegistrationDraft,
  RegistrationProfileDraft,
  StudentRegistrationDraft,
} from "@monteai/types";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function profile(value: Record<string, unknown>): RegistrationProfileDraft | null {
  const email = text(value.email);
  const firstName = text(value.firstName);
  const lastName = text(value.lastName);
  const institute = text(value.institute);
  if (!email || !firstName || !lastName || !institute) return null;

  // Copy only primitives, never the source object or its toJSON/unknown fields.
  return {
    email,
    firstName,
    middleInitial: text(value.middleInitial),
    lastName,
    suffix: text(value.suffix),
    institute,
  };
}

function studentFields(value: Record<string, unknown>) {
  const studentNumber = text(value.studentNumber);
  const position = text(value.position);
  const program = text(value.program);
  const yearLevel = value.yearLevel;
  const section = text(value.section);
  if (
    !studentNumber || !position || !program || !section ||
    typeof yearLevel !== "number" || !Number.isInteger(yearLevel) || yearLevel < 1
  ) return null;

  return { studentNumber, position, program, yearLevel, section };
}

/** Runtime allowlist for both new and legacy web/desktop drafts. */
export function toRegistrationDraft(value: unknown): RegistrationDraft | null {
  const source = record(value);
  if (!source) return null;
  const details = profile(source);
  const id = text(source.id);
  const role = source.role;
  if (!details || !id || (role !== "Student" && role !== "Faculty")) return null;
  const student = role === "Student" ? studentFields(source) : {};
  if (!student) return null;

  return {
    ...details,
    ...student,
    id,
    role,
    // Legacy drafts without consent must return to the consent step, not silently accept it.
    privacyNoticeAccepted: source.privacyNoticeAccepted === true,
    privacyNoticeVersion: text(source.privacyNoticeVersion) ?? "",
    termsAccepted: source.termsAccepted === true,
    termsVersion: text(source.termsVersion) ?? "",
  };
}

/** Runtime allowlist for mobile details; future request fields are not persistable by default. */
export function toStudentRegistrationDraft(value: unknown): StudentRegistrationDraft | null {
  const source = record(value);
  if (!source) return null;
  const details = profile(source);
  const student = studentFields(source);
  return details && student ? { ...details, ...student } : null;
}

export function parseStudentRegistrationDraft(raw: string): StudentRegistrationDraft | null {
  try {
    return toStudentRegistrationDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}
