import { useState } from "react";
import type { ResearchGroupResponseDto } from "@monteai/types";
import type {
  ResearchGroupService,
  StudentService,
  FacultyService,
} from "@monteai/api";
import {
  useCancelResearchGroupInvitation,
  useCreateResearchGroup,
  useDeleteResearchGroup,
  useFaculties,
  useRemoveResearchGroupMember,
  useResearchGroupInvitations,
  useResearchGroups,
  useSendResearchGroupInvitation,
  useStudents,
  useUpdateResearchGroup,
} from "@monteai/hooks";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/common";
import {
  ResearchGroupView,
  ResearchGroupForm,
  type ResearchGroupFormValues,
} from "../components/ResearchGroup";
import { ResearchGroupMembersPanel } from "../components/ResearchGroup/ResearchGroupMembersPanel";

export interface ResearchGroupPageProps {
  researchGroupService: ResearchGroupService;
  /** Optional — enables the leader/adviser pickers in the forms. */
  studentService?: StudentService;
  /** Optional — enables the adviser picker when editing a group. */
  facultyService?: FacultyService;
  /** Current user's role — drives which actions are offered. */
  role?: string;
  /** Student ID enables deletion of the student's own group. */
  studentId?: string;
}

function extractMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { Message?: string } } })
    ?.response;
  return (
    response?.data?.Message ?? (err instanceof Error ? err.message : fallback)
  );
}

export function ResearchGroupPage({
  researchGroupService,
  studentService,
  facultyService,
  role,
  studentId,
}: ResearchGroupPageProps) {
  const {
    data: groups = [],
    isLoading,
    isError,
  } = useResearchGroups(researchGroupService);
  const create = useCreateResearchGroup(researchGroupService);
  const update = useUpdateResearchGroup(researchGroupService);
  const remove = useDeleteResearchGroup(researchGroupService);
  const sendInvitation = useSendResearchGroupInvitation(researchGroupService);
  const cancelInvitation = useCancelResearchGroupInvitation(researchGroupService);
  const removeMember = useRemoveResearchGroupMember(researchGroupService);

  const { data: students = [] } = useStudents(studentService);
  const { data: faculties = [] } = useFaculties(facultyService);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ResearchGroupResponseDto | null>(null);
  const [membersGroup, setMembersGroup] =
    useState<ResearchGroupResponseDto | null>(null);
  const [deleting, setDeleting] = useState<ResearchGroupResponseDto | null>(
    null,
  );

  const { data: invitations = [] } = useResearchGroupInvitations(
    researchGroupService,
    membersGroup?.id,
  );

  const canCreate = role === "Admin" || role === "Student";
  const canEdit =
    role === "Admin" || role === "ProgramHead" || role === "Student";
  const canDelete = role === "Admin";
  const canManageMembers =
    role === "Admin" || role === "ProgramHead" || role === "Student";

  const mutationBusy =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    sendInvitation.isPending ||
    cancelInvitation.isPending ||
    removeMember.isPending;

  const openCreate = () => {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (group: ResearchGroupResponseDto) => {
    setFormMode("edit");
    setEditing(group);
    setFormOpen(true);
  };

  const handleSubmit = async (values: ResearchGroupFormValues) => {
    try {
      if (formMode === "edit" && editing) {
        const dto =
          role === "Student"
            ? { groupName: values.groupName }
            : {
                groupName: values.groupName,
                researchTitle: values.researchTitle,
                adviserId: values.adviserId || undefined,
              };
        const ok = await update.mutateAsync({
          researchGroupId: editing.id,
          dto,
        });
        if (ok) toast.success("Research group updated");
        else toast.error("Couldn't update the research group");
      } else {
        const dto =
          role === "Admin"
            ? values
            : {
                groupName: values.groupName,
                researchTitle: values.researchTitle,
              };
        await create.mutateAsync(dto);
        toast.success("Research group created");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(
        extractMessage(err, "Something went wrong. Please try again."),
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const ok = await remove.mutateAsync(deleting.id);
      if (ok) toast.success("Research group deleted");
      else toast.error("Couldn't delete the research group");
    } catch (err) {
      toast.error(
        extractMessage(err, "Something went wrong while deleting the group."),
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleSendInvitation = async (studentId: string) => {
    if (!membersGroup) return;
    try {
      const ok = await sendInvitation.mutateAsync({
        researchGroupId: membersGroup.id,
        studentId,
      });
      if (ok) toast.success("Invitation sent to the student");
      else toast.error("The student could not be invited. They may already belong to a group or have a pending invitation.");
    } catch (err) {
      toast.error(
        extractMessage(err, "Couldn't send the invitation. The group may be full."),
      );
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!membersGroup) return;
    try {
      const ok = await removeMember.mutateAsync({
        researchGroupId: membersGroup.id,
        studentId,
      });
      if (ok) toast.success("Member removed from the group");
      else toast.error("Couldn't remove the member.");
    } catch (err) {
      toast.error(extractMessage(err, "Couldn't remove the member."));
    }
  };

  const handleCancelInvitation = async (studentId: string) => {
    if (!membersGroup) return;
    try {
      const ok = await cancelInvitation.mutateAsync({
        researchGroupId: membersGroup.id,
        studentId,
      });
      if (ok) toast.success("Invitation canceled");
      else toast.error("Couldn't cancel the invitation.");
    } catch (err) {
      toast.error(extractMessage(err, "Couldn't cancel the invitation."));
    }
  };

  return (
    <>
      <ResearchGroupView
        groups={groups}
        isLoading={isLoading}
        hasError={isError}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canManageMembers={canManageMembers}
        studentId={role === "Student" ? studentId : undefined}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setDeleting}
        onManageMembers={setMembersGroup}
      />

      {formOpen && (
        <ResearchGroupForm
          key={formMode === "edit" ? `edit-${editing?.id}` : "create"}
          open={formOpen}
          mode={formMode}
          role={role}
          group={editing}
          students={role === "Admin" ? students : []}
          faculties={
            role === "Admin" || role === "ProgramHead" ? faculties : []
          }
          submitting={mutationBusy}
          onSubmit={handleSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}

      {membersGroup && (
        <ResearchGroupMembersPanel
          key={membersGroup.id}
          open={membersGroup !== null}
          group={membersGroup}
          studentService={studentService}
          leaderProgram={
            role === "Student"
              ? students.find((s) => s.id === membersGroup.leaderId)?.program
              : undefined
          }
          busy={mutationBusy}
          canManage={canManageMembers}
          invitations={invitations}
          students={students}
          onSendInvitation={handleSendInvitation}
          onRemoveMember={handleRemoveMember}
          onCancelInvitation={handleCancelInvitation}
          onClose={() => setMembersGroup(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete research group?"
        description={
          role === "Student"
            ? `This will permanently delete your research group, "${deleting?.groupName ?? ""}". This action cannot be undone.`
            : `This will permanently remove "${deleting?.groupName ?? ""}" and detach its members and schedules. This action cannot be undone.`
        }
        confirmLabel="Delete group"
        variant="danger"
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
