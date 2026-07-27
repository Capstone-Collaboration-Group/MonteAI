import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@monteai/ui";

type Priority = "Normal" | "Important" | "Urgent";

interface PostAnnouncementPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (announcement: {
    subject: string;
    author: string;
    date: string;
    category: string;
    priority: Priority;
    body: string;
  }) => void;
}

const PRIORITY_OPTIONS: Priority[] = ["Normal", "Important", "Urgent"];

export function PostAnnouncementPanel({ open, onClose, onSubmit }: PostAnnouncementPanelProps) {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [body, setBody] = useState("");

  const handleSubmit = () => {
    onSubmit({
      subject,
      author,
      date,
      category,
      priority,
      body,
    });
    setSubject("");
    setDate("");
    setCategory("");
    setPriority("Normal");
    setBody("");
  };

  return (
    <aside
      className={`w-[420px] bg-surface-container-low border-l border-outline-variant flex flex-col h-full transform transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      } fixed top-0 right-0 z-50 shadow-2xl`}
    >
      <div className="p-6 overflow-y-auto flex-1">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-headline-sm font-headline-sm text-primary">Create Announcement</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Draft an announcement to be broadcast to the institutional community.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-white rounded-xl border border-outline-variant space-y-5">
          <div>
            <label className="text-label-sm font-label-sm text-outline">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Call for Research Proposals 2024"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label-sm font-label-sm text-outline">Author</label>
              <input
                type="text"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="e.g. Academic Affairs"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
              />
            </div>
            <div>
              <label className="text-label-sm font-label-sm text-outline">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-body-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label-sm font-label-sm text-outline">Category</label>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Academic"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
              />
            </div>
            <div>
              <label className="text-label-sm font-label-sm text-outline">Priority</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPriority(option)}
                    className={`min-w-[90px] flex-1 rounded-full px-2 py-1 text-[12px] font-semibold border transition-colors ${
                      priority === option
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-on-surface-variant border-outline-variant"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-label-sm font-label-sm text-outline">Body Content</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Compose your announcement here..."
              className="mt-1 w-full min-h-[140px] resize-y rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-outline-variant bg-white">
        <Button onClick={handleSubmit} className="w-full rounded-full">
          Post Announcement
        </Button>
      </div>
    </aside>
  );
}