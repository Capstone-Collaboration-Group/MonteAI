  import { useMemo, useState } from "react";
  import { Button } from "../Button";
  import { Card } from "../Card";
  import { Input } from "../Input";
  import { PageHeader } from "../common/PageHeader";
  import { formatDate } from "@monteai/utils";
  import { AnnouncementView, type AnnouncementDetail } from "./AnnouncementView";
  import { PostAnnouncementPanel, type AnnouncementFormValues } from "./PostAnnouncementPanel";
  import { getAnnouncementPermissions, type UserRole } from "./permissions";
  import type { Institute } from "./institutes";
  import { useAnnouncements } from "@monteai/hooks";
  import type {AnnouncementService} from "@monteai/api";
  import type { AnnouncementResponseDto } from "@monteai/types";

  interface AnnouncementsPanelProps {
    role: UserRole;
    userInstitute?: Institute;
    announcementService: AnnouncementService;
  }

  function getPriorityClass(priority: string) {
    switch (priority) {
      case "Urgent":
        return "bg-error/10 text-error";
      case "Important":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-secondary-container/20 text-status-approved";
    }
  }

  function mapAnnouncement(
  announcement: AnnouncementResponseDto
): AnnouncementDetail {
  const priority = announcement.priority;

  return {
    id: announcement.id,
    subject: announcement.subject,
    category: announcement.category,
    institute: announcement.institute as Institute,
    postedBy: announcement.author?.fullName ?? "Unknown",
    date: announcement.createdAt
      ? announcement.createdAt.slice(0, 10)
      : "",
    priority,
    priorityClass: getPriorityClass(priority),
    body: announcement.content,
    lastEdited: announcement.lastModified
      ? announcement.lastModified.slice(0, 10)
      : announcement.createdAt
        ? announcement.createdAt.slice(0, 10)
        : "",
  };
}

  export function AnnouncementsPanel({ role, userInstitute, announcementService }: AnnouncementsPanelProps) {
    const {announcements: apiAnnouncements, isLoading, isError, refetch,} = useAnnouncements(announcementService);
    const announcements = useMemo(() => apiAnnouncements.map(mapAnnouncement),[apiAnnouncements]);
    const [isPostAnnouncementOpen, setIsPostAnnouncementOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementDetail | null>(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDetail | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState<"None" | "Normal" | "Important" | "Urgent">("None");
    const [search, setSearch] = useState("");

    const scopedAnnouncements =
      role === "ProgramHead"
        ? announcements.filter((item) => item.institute === userInstitute)
        : announcements;

    const filteredAnnouncements = scopedAnnouncements.filter((item) => {
      if (priorityFilter !== "None" && item.priority !== priorityFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      return (
        item.subject.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.postedBy.toLowerCase().includes(q)
      );
    });

    const listPermissions = getAnnouncementPermissions({ role, userInstitute });

    const handleOpenCreate = () => {
      setEditingAnnouncement(null);
      setIsPostAnnouncementOpen(true);
    };

    const handleClosePanel = () => {
      setIsPostAnnouncementOpen(false);
      setEditingAnnouncement(null);
    };

    const handleSubmitAnnouncement = async (
  formValues: AnnouncementFormValues
) => {
  try {
    if (editingAnnouncement) {
      await announcementService.updateAnnouncement(
        editingAnnouncement.id,
        {
          subject: formValues.subject,
          content: formValues.body,
          category: formValues.category,
          institute: formValues.institute,          
          priority: formValues.priority,
          attachmentUrls: [],
          lastModified: new Date().toISOString(),
        }
      );
    } else {
      await announcementService.createAnnouncement({
        subject: formValues.subject,
        content: formValues.body,
        category: formValues.category,
        institute: formValues.institute,
        priority: formValues.priority,
        attachmentUrls: [],
      });
    }

    await refetch();

    handleClosePanel();
  } catch (error) {
    console.error(
      editingAnnouncement
        ? "Failed to update announcement:"
        : "Failed to create announcement:",
      error
    );
  }
};

    const handleDeleteSelected = async () => {
  if (!selectedAnnouncement) return;

  try {
    await announcementService.deleteAnnouncement(
      selectedAnnouncement.id
    );

    setSelectedAnnouncement(null);

    await refetch();
  } catch (error) {
    console.error("Failed to delete announcement:", error);
  }
};

    const handleEditSelected = () => {
      if (!selectedAnnouncement) return;
      setEditingAnnouncement(selectedAnnouncement);
      setIsPostAnnouncementOpen(true);
    };

    if (selectedAnnouncement) {
      return (
        <>
          <AnnouncementView
            announcement={selectedAnnouncement}
            role={role}
            userInstitute={userInstitute}
            onBack={() => setSelectedAnnouncement(null)}
            onEdit={handleEditSelected}
            onDelete={handleDeleteSelected}
          />

          {(listPermissions.canCreate || listPermissions.canEdit) && (
            <PostAnnouncementPanel
            key={`${isPostAnnouncementOpen}-${editingAnnouncement?.subject ?? "new"}`}
              open={isPostAnnouncementOpen}
              initialValues={
                editingAnnouncement
                  ? {
                      subject: editingAnnouncement.subject,
                      author: editingAnnouncement.postedBy,
                      date: editingAnnouncement.date,
                      category: editingAnnouncement.category,
                      institute: editingAnnouncement.institute,
                      priority: editingAnnouncement.priority,
                      body: editingAnnouncement.body,
                    }
                  : null
              }
              onClose={handleClosePanel}
              onSubmit={handleSubmitAnnouncement}
            />
          )}
        </>
      );
    }

    if (isLoading) {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm text-on-surface-variant">
          Loading announcements...
        </p>
      </div>
    </div>
  );
}

if (isError) {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm text-error">
          Failed to load announcements.
        </p>
      </div>
    </div>
  );
}

    return (
      <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <PageHeader
            eyebrow="Announcements management"
            title="Overview"
            actions={
              <>
                <div className="w-full sm:w-80">
                  <Input
                    placeholder="Search by subject, category, or author"
                    value={search}
                    onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                    className="rounded-full border-outline-variant bg-surface-container-low"
                  />
                </div>
                {listPermissions.canCreate && (
                  <Button variant="secondary" className="rounded-full" onClick={handleOpenCreate}>
                    + New announcement
                  </Button>
                )}
              </>
            }
          />

          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Announcements</h3>
                <p className="text-sm text-on-surface-variant">Latest posts across the MonteSkolar ecosystem</p>
              </div>
              <div className="relative flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="rounded-full px-3 py-2 text-sm"
                  onClick={() => setIsFilterOpen((current) => !current)}
                >
                  Filter
                </Button>

                {isFilterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-outline-variant/70 bg-surface p-3 shadow-xl">
                    {(["None", "Normal", "Important", "Urgent"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setPriorityFilter(option);
                          setIsFilterOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          priorityFilter === option
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-surface-container-high"
                        }`}
                      >
                        <span>{option}</span>
                        {priorityFilter === option && <span className="text-xs font-semibold">Selected</span>}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-outline">
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Institute</th>
                    <th className="px-6 py-4">Posted by</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnnouncements.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-outline-variant/40 bg-surface/70 hover:bg-surface-container-high cursor-pointer"
                      onClick={() => setSelectedAnnouncement(item)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-on-surface">{item.subject}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{item.category}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{item.institute}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{item.postedBy}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(item.date)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.priorityClass}`}>
                          {item.priority}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredAnnouncements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-on-surface-variant">
                        No announcements to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {(listPermissions.canCreate || listPermissions.canEdit) && (
          <PostAnnouncementPanel
          key={`${isPostAnnouncementOpen}-${editingAnnouncement?.subject ?? "new"}`}
            open={isPostAnnouncementOpen}
            initialValues={
              editingAnnouncement
                ? {
                    subject: editingAnnouncement.subject,
                    author: editingAnnouncement.postedBy,
                    date: editingAnnouncement.date,
                    category: editingAnnouncement.category,
                    institute: editingAnnouncement.institute,
                    priority: editingAnnouncement.priority,
                    body: editingAnnouncement.body,
                  }
                : null
            }
            onClose={handleClosePanel}
            onSubmit={handleSubmitAnnouncement}
          />
        )}
      </div>
    );
  }