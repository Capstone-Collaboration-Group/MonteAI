import { useState } from "react";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { PageHeader } from "../common/PageHeader";
import { formatDate } from "@monteai/utils";
import { AnnouncementView, type AnnouncementDetail } from "./AnnouncementView";
import { PostAnnouncementPanel, type AnnouncementFormValues } from "./PostAnnouncementPanel";
import { getAnnouncementPermissions, type UserRole } from "./permissions";
import type { Institute } from "./institutes";

interface AnnouncementsPanelProps {
  role: UserRole;
  userInstitute?: Institute;
}

const SAMPLE_ANNOUNCEMENTS: AnnouncementDetail[] = [
  {
    id: 1,
    subject: "Spring Semester Graduation Ceremony Schedule",
    category: "Academic",
    institute: "Institute of Computing Studies",
    postedBy: "John Christian Joyo",
    date: "2026-07-20",
    priority: "Important",
    priorityClass: "bg-amber-100 text-amber-700",
    body: "The spring graduation ceremony schedule is now available for all graduating students.",
    lastEdited: "2026-07-20",
  },
];

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

export function AnnouncementsPanel({ role, userInstitute }: AnnouncementsPanelProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementDetail[]>(SAMPLE_ANNOUNCEMENTS);
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

  const handleSubmitAnnouncement = (formValues: AnnouncementFormValues) => {
    const priorityClass = getPriorityClass(formValues.priority);

    if (editingAnnouncement) {
      const updated: AnnouncementDetail = {
        ...editingAnnouncement,
        subject: formValues.subject,
        category: formValues.category,
        institute: formValues.institute,
        postedBy: formValues.author,
        date: formValues.date,
        priority: formValues.priority,
        body: formValues.body,
        lastEdited: new Date().toISOString().slice(0, 10),
        priorityClass,
      };

      setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedAnnouncement(updated);
    } else {
      setAnnouncements((current) => {
        const nextId = current.length > 0 ? Math.max(...current.map((item) => item.id)) + 1 : 1;
        const newAnnouncement: AnnouncementDetail = {
          id: nextId,
          subject: formValues.subject,
          category: formValues.category,
          institute: formValues.institute,
          postedBy: formValues.author,
          date: formValues.date,
          priority: formValues.priority,
          body: formValues.body,
          lastEdited: formValues.date,
          priorityClass,
        };

        return [newAnnouncement, ...current];
      });
    }

    handleClosePanel();
  };

  const handleDeleteSelected = () => {
    if (!selectedAnnouncement) return;
    setAnnouncements((current) => current.filter((item) => item.id !== selectedAnnouncement.id));
    setSelectedAnnouncement(null);
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