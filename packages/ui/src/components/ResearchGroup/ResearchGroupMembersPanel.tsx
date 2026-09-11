import { useEffect, useMemo, useState } from "react";
import { UserMinus, UserPlus, Search } from "lucide-react";
import type {
  ResearchGroupMemberDto,
  ResearchGroupResponseDto,
  StudentResponseDto,
} from "@monteai/types";
import type { StudentService } from "@monteai/api";
import { useStudentDirectory } from "@monteai/hooks";
import { fullNameHelper } from "@monteai/utils";
import { Button, Input } from "../../index";
import { Badge, ConfirmDialog } from "../common";
import { Drawer } from "../common/Drawer";
import { DrawerHeader } from "../common/DrawerHeader";

export interface ResearchGroupMembersPanelProps {
  open: boolean;
  group: ResearchGroupResponseDto | null;
  /** Enables server-side directory search (name or student number). */
  studentService?: StudentService;
  /**
   * When set (students), only classmates in this program can be invited.
   * Program Heads and Admins may invite across programs.
   */
  leaderProgram?: string;
  busy?: boolean;
  canManage?: boolean;
  onAddMember: (studentId: string) => void;
  onRemoveMember: (studentId: string) => void;
  onClose: () => void;
}

export function ResearchGroupMembersPanel({
  open,
  group,
  studentService,
  leaderProgram,
  busy = false,
  canManage = false,
  onAddMember,
  onRemoveMember,
  onClose,
}: ResearchGroupMembersPanelProps) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState<
    | { kind: "add"; student: StudentResponseDto }
    | { kind: "remove"; member: ResearchGroupMemberDto }
    | null
  >(null);

  // Debounce so we query the directory only after the user pauses typing.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data: directory = [], isFetching } = useStudentDirectory(
    open ? studentService : undefined,
    debounced,
    leaderProgram,
  );

  const memberIds = useMemo(
    () => new Set(group?.members.map((member) => member.id) ?? []),
    [group],
  );

  const invitable = useMemo(
    () =>
      directory.filter(
        (student) => !memberIds.has(student.id) && !student.researchGroup,
      ),
    [directory, memberIds],
  );

  const isFull = (group?.members.length ?? 0) >= 4;

  const pendingName = pending
    ? pending.kind === "add"
      ? fullNameHelper(
          pending.student.firstName,
          pending.student.middleInitial,
          pending.student.lastName,
          pending.student.suffix,
        )
      : pending.member.name || pending.member.studentNumber || pending.member.id
    : "";

  const confirmInvite = () => {
    if (pending?.kind === "add") onAddMember(pending.student.id);
    setPending(null);
  };

  const confirmRemove = () => {
    if (pending?.kind === "remove") onRemoveMember(pending.member.id);
    setPending(null);
  };

  return (
    <>
      <Drawer isOpen={open} onClose={onClose} position="right" size="lg">
      <DrawerHeader onClose={onClose}>
        <div>
          <p className="text-lg font-semibold text-on-surface">
            {group?.groupName ?? "Group"} — members
          </p>
          <p className="mt-0.5 text-xs font-normal text-on-surface-variant">
            A research group may have up to four students, including the leader.
          </p>
        </div>
      </DrawerHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {group && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {group.researchTitle}
              </p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {group.institute || "Institute not specified"}
              </p>
            </div>
            <Badge variant={isFull ? "defense" : "surface"} dot>
              {group.members.length}/4
            </Badge>
          </div>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-on-surface">
            Current members
          </h3>
          {group && group.members.length > 0 ? (
            <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
              {group.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {member.name || member.studentNumber || member.id}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {member.position}
                      {member.program ? ` — ${member.program}` : ""}
                    </p>
                  </div>
                  {canManage && member.id !== group.leaderId && (
                    <Button
                      variant="ghost"
                      className="shrink-0 px-2 py-1 text-xs text-error hover:text-error"
                      disabled={busy}
                      onClick={() => setPending({ kind: "remove", member })}
                      aria-label={`Remove ${member.name || member.id}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <UserMinus className="h-3.5 w-3.5" /> Remove
                      </span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-on-surface-variant">
              No members assigned yet.
            </p>
          )}
        </section>

        {canManage && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-on-surface">
              Invite a student
            </h3>
            {isFull ? (
              <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                This group is full (4/4). Remove a member before inviting
                another student.
              </p>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant">
                  {leaderProgram
                    ? `Search among students in ${leaderProgram} by name or student number.`
                    : "Search by full name or student number."}
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <Input
                    className="border-outline/30 pl-9 focus:border-primary focus:ring-primary/20"
                    placeholder="Search name or student number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search students to invite"
                  />
                </div>

                {isFetching && directory.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Searching…</p>
                ) : invitable.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">
                    {debounced
                      ? "No matching students found."
                      : "No other students are available to invite."}
                  </p>
                ) : (
                  <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                    {invitable.map((student) => (
                      <li
                        key={student.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {fullNameHelper(
                              student.firstName,
                              student.middleInitial,
                              student.lastName,
                              student.suffix,
                            )}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {student.studentNumber}
                            {student.program ? ` — ${student.program}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          className="shrink-0 px-2 py-1 text-xs"
                          disabled={busy}
                          onClick={() => setPending({ kind: "add", student })}
                          aria-label={`Invite ${student.firstName} ${student.lastName}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <UserPlus className="h-3.5 w-3.5" /> Invite
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </div>
      </Drawer>

      <ConfirmDialog
        open={pending !== null}
        variant={pending?.kind === "remove" ? "danger" : "success"}
        title={pending?.kind === "remove" ? "Remove member?" : "Invite student?"}
        description={
          pending?.kind === "remove"
            ? `Remove ${pendingName} from ${group?.groupName ?? "this group"}? This frees a slot for another student.`
            : `Invite ${pendingName} to ${group?.groupName ?? "this group"}? They will be added as a member.`
        }
        confirmLabel={pending?.kind === "remove" ? "Confirm Remove" : "Confirm Invite"}
        loading={busy}
        onConfirm={pending?.kind === "remove" ? confirmRemove : confirmInvite}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
