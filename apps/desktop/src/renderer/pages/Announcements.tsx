import { Button, Card, Input } from "@monteai/ui";
import { useState } from "react";
import { formatDate } from "@monteai/utils";
import { AnnouncementView, AnnouncementDetail } from "./AnnouncementView";
import { PostAnnouncementPanel } from "./PostAnnouncementPanel";

const initialAnnouncements: AnnouncementDetail[] = [
  {
    id: 1,
    subject: "Call for Q4 Research Proposals: Sustainability & AI",
    category: "Research",
    postedBy: "Charles Bernard Balaguer",
    date: "2026-07-24",
    priority: "Urgent",
    priorityClass: "bg-error/10 text-error",
    body: "We are inviting proposals for projects focused on sustainability and AI integration.",
    lastEdited: "2026-07-24",
  },
  {
    id: 2,
    subject: "Spring Semester Graduation Ceremony Schedule",
    category: "Academic",
    postedBy: "John Christian Joyo",
    date: "2026-07-20",
    priority: "Important",
    priorityClass: "bg-amber-100 text-amber-700",
    body: "The spring graduation ceremony schedule is now available for all graduating students.",
    lastEdited: "2026-07-20",
  },
  {
    id: 3,
    subject: "Maintenance Notice - Library Research Database",
    category: "System",
    postedBy: "Reca Mae Montebon",
    date: "2026-07-22",
    priority: "Normal",
    priorityClass: "bg-secondary-container/20 text-status-approved",
    body: "The library research database will be down for maintenance between 1 AM and 4 AM.",
    lastEdited: "2026-07-22",
  },
  {
    id: 4,
    subject: "2022 Summer Workshop Recap",
    category: "Events",
    postedBy: "Angelica Buenaagua",
    date: "2026-07-23",
    priority: "Normal",
    priorityClass: "bg-secondary-container/20 text-status-approved",
    body: "A recap of the summer workshop highlights and follow-up sessions.",
    lastEdited: "2026-07-23",
  },
];

export default function Announcements() {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [isPostAnnouncementOpen, setIsPostAnnouncementOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDetail | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"None" | "Normal" | "Important" | "Urgent">("None");
  const [search, setSearch] = useState("");

  const filteredAnnouncements = announcements.filter((item) => {
    if (priorityFilter !== "None" && item.priority !== priorityFilter) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return (
      item.subject.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.postedBy.toLowerCase().includes(q)
    );
  });

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "bg-error/10 text-error";
      case "Important":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-secondary-container/20 text-status-approved";
    }
  };

  const handleNewAnnouncement = () => {
    setIsPostAnnouncementOpen(true);
  };

  const handleClosePanel = () => {
    setIsPostAnnouncementOpen(false);
  };

  const handleSubmitAnnouncement = (announcement: {
    subject: string;
    author: string;
    date: string;
    category: string;
    priority: string;
    body: string;
  }) => {
    const newAnnouncement: AnnouncementDetail = {
      id: announcements.length + 1,
      subject: announcement.subject,
      category: announcement.category,
      postedBy: announcement.author,
      date: announcement.date,
      priority: announcement.priority as "Normal" | "Important" | "Urgent",
      body: announcement.body,
      lastEdited: announcement.date,
      priorityClass: getPriorityClass(announcement.priority),
    };

    setAnnouncements((current) => [newAnnouncement, ...current]);
    setIsPostAnnouncementOpen(false);
    setPriorityFilter("None");
  };

  const handleSelectAnnouncement = (announcement: AnnouncementDetail) => {
    setSelectedAnnouncement(announcement);
  };

  const handleBackFromView = () => {
    setSelectedAnnouncement(null);
  };

  if (selectedAnnouncement) {
    return (
      <AnnouncementView
        announcement={selectedAnnouncement}
        onBack={handleBackFromView}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Announcements management</p>
            <h2 className="text-2xl font-semibold text-on-surface">Overview</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search by subject, category, or author"
                value={search}
                onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                className="rounded-full border-outline-variant bg-surface-container-low"
              />
            </div>
            <Button variant="secondary" className="rounded-full" onClick={handleNewAnnouncement}>
              + New announcement
            </Button>
          </div>
        </header>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">Recent announcements</h3>
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
                  <th className="px-6 py-4">Posted by</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Priority</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map((item) => (
                  <tr
                    key={`${item.subject}-${item.date}`}
                    className="border-t border-outline-variant/40 bg-surface/70 hover:bg-surface-container-high cursor-pointer"
                    onClick={() => handleSelectAnnouncement(item)}
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-on-surface">{item.subject}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.postedBy}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(item.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.priorityClass}`}>
                        {item.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <PostAnnouncementPanel
        open={isPostAnnouncementOpen}
        onClose={handleClosePanel}
        onSubmit={handleSubmitAnnouncement}
      />
    </div>
  );
}