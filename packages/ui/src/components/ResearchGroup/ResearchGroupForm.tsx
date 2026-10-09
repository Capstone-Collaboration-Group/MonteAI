import { useState } from "react";
import type {
  ResearchGroupResponseDto,
  StudentResponseDto,
  FacultyResponseDto,
} from "@monteai/types";
import { fullNameHelper } from "@monteai/utils";
import { Button, Input } from "../../index";
import { Select } from "../common";
import { Drawer } from "../common/Drawer";
import { DrawerHeader } from "../common/DrawerHeader";

export interface ResearchGroupFormValues {
  groupName: string;
  researchTitle: string;
  adviserId: string;
  leaderId: string;
}

export interface ResearchGroupFormProps {
  open: boolean;
  mode: "create" | "edit";
  role?: string;
  group?: ResearchGroupResponseDto | null;
  students?: StudentResponseDto[];
  faculties?: FacultyResponseDto[];
  submitting?: boolean;
  onSubmit: (values: ResearchGroupFormValues) => void;
  onClose: () => void;
}

const emptyValues: ResearchGroupFormValues = {
  groupName: "",
  researchTitle: "",
  adviserId: "",
  leaderId: "",
};

function initialValues(mode: "create" | "edit", group?: ResearchGroupResponseDto | null) {
  if (mode === "edit" && group) {
    return {
      groupName: group.groupName,
      researchTitle: group.researchTitle,
      adviserId: group.adviserId,
      leaderId: group.leaderId,
    };
  }
  return emptyValues;
}

export function ResearchGroupForm({
  open,
  mode,
  role,
  group,
  students = [],
  faculties = [],
  submitting = false,
  onSubmit,
  onClose,
}: ResearchGroupFormProps) {
  const [values, setValues] = useState<ResearchGroupFormValues>(() =>
    initialValues(mode, group),
  );
  const [error, setError] = useState("");

  const isAdmin = role === "Admin";
  const isStudent = role === "Student";
  // Students may only rename the group; ProgramHead/Admin may edit every field.
  const canEditMeta = mode === "create" || !isStudent;
  const leaderLabel = students.find((s) => s.id === values.leaderId);

  const set = (key: keyof ResearchGroupFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!values.groupName.trim()) {
      setError("Group name is required.");
      return;
    }
    if (mode === "create" && !values.researchTitle.trim()) {
      setError("Research title is required.");
      return;
    }
    if (mode === "create" && isAdmin && !values.leaderId) {
      setError("Please select a group leader.");
      return;
    }
    setError("");
    onSubmit(values);
  };

  const studentOptions = students.map((student) => ({
    label: `${fullNameHelper(student.firstName, student.middleInitial, student.lastName, student.suffix)} (${student.studentNumber})`,
    value: student.id,
  }));

  const facultyOptions = [
    { label: "No adviser assigned", value: "" },
    ...faculties.map((faculty) => ({
      label: `${fullNameHelper(faculty.firstName, faculty.middleInitial, faculty.lastName, faculty.suffix)}`,
      value: faculty.id,
    })),
  ];

  return (
    <Drawer isOpen={open} onClose={onClose} position="right" size="lg">
      <DrawerHeader onClose={onClose}>
        <div>
          <p className="text-lg font-semibold text-on-surface">
            {mode === "create" ? "Create research group" : `Edit ${group?.groupName ?? "group"}`}
          </p>
          <p className="mt-0.5 text-xs font-normal text-on-surface-variant">
            {mode === "create"
              ? isStudent
                ? "You will be the leader of the group you create."
                : "Assign a student leader and optionally an adviser."
              : isStudent
                ? "You can rename your group here."
                : "Update the group's details."}
          </p>
        </div>
      </DrawerHeader>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-on-surface" htmlFor="rg-name">
            Group name
          </label>
          <Input
            id="rg-name"
            className="border-outline/30 focus:border-primary focus:ring-primary/20"
            placeholder="e.g. Group Alpha"
            value={values.groupName}
            onChange={(e) => set("groupName", e.target.value)}
            maxLength={100}
          />
        </div>

        {canEditMeta && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface" htmlFor="rg-title">
              Research title
            </label>
            <Input
              id="rg-title"
              className="border-outline/30 focus:border-primary focus:ring-primary/20"
              placeholder="e.g. AI-Driven Student Performance Prediction"
              value={values.researchTitle}
              onChange={(e) => set("researchTitle", e.target.value)}
              maxLength={255}
            />
          </div>
        )}

        {mode === "create" && isAdmin && (
          <Select
            label="Group leader"
            placeholder="Select a student..."
            options={studentOptions}
            value={values.leaderId}
            onChange={(value) => set("leaderId", value)}
          />
        )}

        {mode === "edit" && !isStudent && (
          <Select
            label="Adviser"
            placeholder={faculties.length ? "Select a faculty..." : "No adviser assigned"}
            options={facultyOptions}
            value={values.adviserId}
            onChange={(value) => set("adviserId", value)}
          />
        )}

        {mode === "edit" && group && (
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm">
            <p className="font-medium text-on-surface">Leader</p>
            <p className="mt-1 text-on-surface-variant">
              {leaderLabel
                ? fullNameHelper(leaderLabel.firstName, leaderLabel.middleInitial, leaderLabel.lastName, leaderLabel.suffix)
                : group.leaderId}
            </p>
            {group.members.length > 0 && (
              <p className="mt-3 font-medium text-on-surface">Members</p>
            )}
            <ul className="mt-1 space-y-1 text-on-surface-variant">
              {group.members.map((member) => (
                <li key={member.id}>
                  {member.name || member.studentNumber || member.id} — {member.position}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-outline-variant p-4">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting
            ? "Saving..."
            : mode === "create"
              ? "Create group"
              : "Save changes"}
        </Button>
      </div>
    </Drawer>
  );
}
