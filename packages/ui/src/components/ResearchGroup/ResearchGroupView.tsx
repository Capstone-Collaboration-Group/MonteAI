import { useMemo, useState } from "react";
import { Users, Search, Plus, Pencil, Trash2, UserCog } from "lucide-react";
import type { ResearchGroupResponseDto } from "@monteai/types";
import { Button, Input, Card } from "../../index";
import {
  PageHeader,
  StatCardGrid,
  EmptyState,
  ErrorState,
  Badge,
  type StatCardItem,
} from "../common";
import { ResearchGroupViewSkeleton } from "./skeletons/ResearchGroupViewSkeleton";

export interface ResearchGroupViewProps {
  groups: ResearchGroupResponseDto[];
  isLoading?: boolean;
  hasError?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canManageMembers?: boolean;
  onCreate?: () => void;
  onEdit?: (group: ResearchGroupResponseDto) => void;
  onDelete?: (group: ResearchGroupResponseDto) => void;
  onManageMembers?: (group: ResearchGroupResponseDto) => void;
}

export function ResearchGroupView({
  groups,
  isLoading = false,
  hasError = false,
  canCreate = false,
  canEdit = false,
  canDelete = false,
  canManageMembers = false,
  onCreate,
  onEdit,
  onDelete,
  onManageMembers,
}: ResearchGroupViewProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (group) =>
        group.groupName.toLowerCase().includes(query) ||
        group.researchTitle.toLowerCase().includes(query) ||
        group.institute.toLowerCase().includes(query) ||
        group.members.some((member) =>
          `${member.name} ${member.studentNumber}`.toLowerCase().includes(query),
        ),
    );
  }, [groups, search]);

  const stats: StatCardItem[] = useMemo(
    () => [
      {
        id: "groups",
        icon: Users,
        label: "Research groups",
        value: groups.length,
        accent: "bg-primary-container text-on-primary-container",
      },
      {
        id: "members",
        icon: UserCog,
        label: "Total members",
        value: groups.reduce((sum, group) => sum + group.members.length, 0),
        accent: "bg-secondary-container text-on-secondary",
      },
      {
        id: "full",
        icon: Users,
        label: "Full groups (4/4)",
        value: groups.filter((group) => group.members.length >= 4).length,
        accent: "bg-surface-container-high text-on-surface-variant",
      },
    ],
    [groups],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-container-low/60 p-6 font-sans lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <ResearchGroupViewSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 font-sans lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          eyebrow="Research management"
          title="Research groups"
          actions={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <Input
                  className="w-full bg-surface pl-9 sm:w-64"
                  placeholder="Search groups, titles, members..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search research groups"
                />
              </div>
              {canCreate && (
                <Button onClick={onCreate}>
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> New group
                  </span>
                </Button>
              )}
            </>
          }
        />

        {hasError ? (
          <ErrorState
            title="Couldn't load research groups"
            message="We encountered a problem while fetching the research groups. Please try again later."
          />
        ) : (
          <>
            <StatCardGrid stats={stats} />

            {groups.length === 0 ? (
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="No research groups yet"
                description={
                  canCreate
                    ? "Research groups are teams of up to four students working on one thesis. Create the first one to get started."
                    : "Research groups will appear here once students start forming their thesis teams."
                }
                action={
                  canCreate ? (
                    <Button onClick={onCreate}>
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create a group
                      </span>
                    </Button>
                  ) : undefined
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-10 w-10" />}
                title="No matches found"
                description={`No research groups match "${search}". Try a different search term.`}
              />
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((group) => (
                  <Card key={group.id} className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary-container p-3 text-on-primary-container">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-on-surface">
                            {group.groupName}
                          </h3>
                          <p className="text-xs text-on-surface-variant">
                            {group.institute || "Institute not specified"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={group.members.length >= 4 ? "defense" : "surface"}
                        dot
                        size="sm"
                      >
                        {group.members.length}/4 members
                      </Badge>
                    </div>

                    <p className="line-clamp-2 text-sm text-on-surface-variant">
                      {group.researchTitle}
                    </p>

                    <div className="flex-1 space-y-2 border-t border-outline-variant pt-3">
                      {group.members.length === 0 ? (
                        <p className="text-xs text-on-surface-variant">
                          No members assigned yet.
                        </p>
                      ) : (
                        group.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="truncate text-on-surface">
                              {member.name || member.studentNumber || member.id}
                            </span>
                            <span className="shrink-0 text-xs text-on-surface-variant">
                              {member.position}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-3">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => onEdit?.(group)}
                        >
                          <span className="flex items-center gap-1.5">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </span>
                        </Button>
                      )}
                      {canManageMembers && (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => onManageMembers?.(group)}
                        >
                          <span className="flex items-center gap-1.5">
                            <UserCog className="h-3.5 w-3.5" /> Members
                          </span>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="px-3 py-1.5 text-xs text-error hover:text-error"
                          onClick={() => onDelete?.(group)}
                        >
                          <span className="flex items-center gap-1.5">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </span>
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
